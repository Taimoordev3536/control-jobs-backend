import {
  Injectable,
  Logger,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Cron } from '@nestjs/schedule';
import { WorkSession } from '../entities/work-session.entity';
import { Job } from '../entities/job.entity';
import { JobScheduleService } from './job-schedule.service';
import { ScheduleType } from '../entities/schedule-type.enum';
import { EmployerUser } from '../../employers/entities/employer-user.entity';
import { WorkerUser } from '../../workers/entities/worker-user.entity';
import { User } from '../../users/entities/user.entity';
import { UserRole } from '../../auth/enums/user-role.enum';
import { AttendancePolicyService } from '../../attendance-policy/attendance-policy.service';

export type OvertimeStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

export interface OvertimeDecision {
  minutes: number;
  basisMinutes: number;
  status: OvertimeStatus | null;
}

/**
 * Overtime per closed session, stored rather than derived.
 *
 * Deriving it from the job's current schedule meant editing a schedule
 * rewrote history; Art. 35.5 ET requires the record to distinguish overtime,
 * so it has to be fixed at the time it happened.
 *
 * Filled by a sweep rather than at each close: sessions close through six
 * different paths (QR, manual, watchdog, review correction, manual-attendance
 * approve and edit), and one of them forgetting would leave a silent gap.
 */
@Injectable()
export class OvertimeService {
  private readonly logger = new Logger(OvertimeService.name);
  private running = false;

  constructor(
    @InjectRepository(WorkSession) private readonly sessionRepo: Repository<WorkSession>,
    @InjectRepository(Job) private readonly jobRepo: Repository<Job>,
    @InjectRepository(EmployerUser) private readonly employerUserRepo: Repository<EmployerUser>,
    @InjectRepository(WorkerUser) private readonly workerUserRepo: Repository<WorkerUser>,
    @InjectRepository(User) private readonly userRepo: Repository<User>,
    private readonly schedule: JobScheduleService,
    private readonly policies: AttendancePolicyService,
    private readonly dataSource: DataSource,
  ) {}

  /**
   * The employer that owns the session, or null for an admin who sees all.
   * Only the employer decides: the record and the liability are theirs.
   */
  private async employerScope(userId: number): Promise<number | null> {
    const user = await this.userRepo.findOne({ where: { id: userId }, relations: ['role'] });
    if (!user) throw new NotFoundException('User not found');
    if (user.role?.value === UserRole.Admin) return null;
    if (user.role?.value !== UserRole.Employer) {
      throw new ForbiddenException('Only the employer can decide on overtime');
    }
    const eu = await this.employerUserRepo.findOne({
      where: { user: { id: userId } },
      relations: ['employer'],
    });
    if (!eu?.employer?.id) throw new ForbiddenException('Not an employer');
    return eu.employer.id;
  }

  /** Overtime waiting on a decision, for the caller's own workers. */
  async listPending(userId: number) {
    const employerId = await this.employerScope(userId);
    const rows = await this.sessionRepo
      .createQueryBuilder('ws')
      .leftJoinAndSelect('ws.job', 'job')
      .leftJoinAndSelect('ws.worker', 'worker')
      .leftJoin('job.employer', 'employer')
      .where(`ws.overtime_status = 'PENDING'`)
      .andWhere(employerId === null ? '1=1' : 'employer.id = :employerId', { employerId })
      .orderBy('ws.check_in_time', 'DESC')
      .getMany();
    return rows;
  }

  async countPending(userId: number): Promise<number> {
    return (await this.listPending(userId)).length;
  }

  private async loadOwned(publicId: string, userId: number): Promise<WorkSession> {
    const employerId = await this.employerScope(userId);
    const session = await this.sessionRepo.findOne({
      where: { publicId },
      relations: ['job', 'job.employer'],
    });
    if (!session) throw new NotFoundException('Session not found');
    if (employerId !== null && (session.job as any)?.employer?.id !== employerId) {
      throw new ForbiddenException('This session belongs to another company');
    }
    if (session.overtimeStatus !== 'PENDING') {
      throw new BadRequestException(
        session.overtimeStatus
          ? `This overtime was already ${String(session.overtimeStatus).toLowerCase()}`
          : 'This session has no overtime to decide on',
      );
    }
    return session;
  }

  /**
   * Accept the overtime. Refused once the year's cap is reached: Art. 35.2 ET
   * makes the cap a limit on what may be worked, so approving past it would
   * record a breach rather than prevent one.
   */
  async approve(
    publicId: string,
    userId: number,
    compensation?: 'PAID' | 'TIME_OFF',
  ): Promise<WorkSession> {
    const session = await this.loadOwned(publicId, userId);
    const policy = await this.policies.resolve(session.jobId, session.workerId);

    const year = new Date(session.checkInTime).getFullYear();
    const sofar = await this.annualTotal(session.workerId, year, policy.overtimeAnnualCapHours);
    const adding = Math.round(((session.overtimeMinutes || 0) / 60) * 100) / 100;
    if (policy.overtimeAnnualCapHours > 0 && sofar.hours + adding > policy.overtimeAnnualCapHours) {
      throw new BadRequestException(
        `Approving ${adding} h would take ${year} to ${Math.round((sofar.hours + adding) * 100) / 100} h, ` +
          `over the ${policy.overtimeAnnualCapHours} h limit. ` +
          (sofar.remainingHours > 0 ? `${sofar.remainingHours} h remain.` : 'The limit is already reached.'),
      );
    }

    session.overtimeStatus = 'APPROVED';
    session.overtimeCompensation = compensation || policy.overtimeDefaultCompensation;
    return this.sessionRepo.save(session);
  }

  /** A worker's approved overtime for a year, resolved by their public id. */
  async annualForWorker(workerPublicId: string, userId: number, year?: number) {
    const employerId = await this.employerScope(userId);
    const [w] = await this.dataSource.query(
      `SELECT w.id FROM workers w
        WHERE w.public_id = $1
          AND ($2::int IS NULL OR EXISTS (
                SELECT 1 FROM "employerWorkers" ew
                 WHERE ew."workerId" = w.id AND ew."employerId" = $2))`,
      [workerPublicId, employerId],
    );
    if (!w) throw new NotFoundException('Worker not found');
    const policy = await this.policies.resolveForEmployer(employerId);
    return this.annualTotal(w.id, year || new Date().getFullYear(), policy.overtimeAnnualCapHours);
  }

  /**
   * A worker's own overtime for a year: the running total against the cap and
   * the sessions behind it. Read-only — the worker sees, the employer decides.
   */
  async mine(userId: number, year?: number) {
    const wu = await this.workerUserRepo.findOne({ where: { userId } });
    if (!wu?.workerId) throw new ForbiddenException('Not a worker');
    const y = year || new Date().getFullYear();

    const [emp] = await this.dataSource.query(
      `SELECT "employerId" FROM "employerWorkers" WHERE "workerId" = $1 LIMIT 1`,
      [wu.workerId],
    );
    const policy = await this.policies.resolveForEmployer(emp?.employerId ?? null);
    const total = await this.annualTotal(wu.workerId, y, policy.overtimeAnnualCapHours);

    const sessions = await this.dataSource.query(
      `SELECT ws.public_id AS "publicId", ws.check_in_time AS "checkInTime",
              ws.check_out_time AS "checkOutTime", ws.overtime_minutes AS "overtimeMinutes",
              ws.overtime_status AS "overtimeStatus",
              ws.overtime_compensation AS "overtimeCompensation",
              j."jobName" AS "jobName"
         FROM work_sessions ws JOIN job j ON j.id = ws.job_id
        WHERE ws.worker_id = $1
          AND ws.overtime_minutes > 0
          AND ws.check_in_time >= make_date($2, 1, 1)
          AND ws.check_in_time < make_date($2 + 1, 1, 1)
        ORDER BY ws.check_in_time DESC`,
      [wu.workerId, y],
    );

    const pendingMinutes = sessions
      .filter((r: any) => r.overtimeStatus === 'PENDING')
      .reduce((sum: number, r: any) => sum + Number(r.overtimeMinutes || 0), 0);

    return {
      ...total,
      pendingHours: Math.round((pendingMinutes / 60) * 100) / 100,
      sessions,
    };
  }

  /** Refuse the overtime. The attendance record is untouched either way. */
  async reject(publicId: string, userId: number): Promise<WorkSession> {
    const session = await this.loadOwned(publicId, userId);
    session.overtimeStatus = 'REJECTED';
    session.overtimeCompensation = null;
    return this.sessionRepo.save(session);
  }

  /**
   * Overtime for one closed session.
   *
   * A free job has no fixed hours to exceed, so its time is worked time and
   * never overtime. On a job that does have a schedule, a day with no shift
   * is a rest day, and the whole session is time beyond the ordinary working
   * day — treating it as zero, which is what deriving from scheduled minutes
   * alone did, hid a full day worked outside the roster.
   */
  decide(
    hasSchedule: boolean,
    scheduledMinutes: number,
    workedMinutes: number,
  ): OvertimeDecision {
    const worked = Math.max(0, workedMinutes || 0);
    const scheduled = Math.max(0, scheduledMinutes || 0);
    const minutes = !hasSchedule
      ? 0
      : scheduled > 0
        ? Math.max(0, worked - scheduled)
        : worked;
    return {
      minutes,
      basisMinutes: worked,
      // Nothing to approve when there is no overtime.
      status: minutes > 0 ? 'PENDING' : null,
    };
  }

  /** Whether the job defines a roster at all, as opposed to being free. */
  private hasSchedule(job: Job): boolean {
    if ((job as any).scheduleType === ScheduleType.FREE) return false;
    return ((job as any).seasonalSchedules || []).some(
      (s: any) => (s.shifts || []).length > 0,
    );
  }

  /**
   * Approved overtime for a worker in a calendar year, against the cap.
   * Art. 35.2 ET caps it at 80 hours a year, but the real figure comes from
   * the convenio, so the cap is passed in.
   */
  async annualTotal(workerId: number, year: number, capHours: number) {
    const [row] = await this.dataSource.query(
      `SELECT COALESCE(SUM(overtime_minutes), 0) AS mins
         FROM work_sessions
        WHERE worker_id = $1
          AND overtime_status = 'APPROVED'
          AND check_in_time >= make_date($2, 1, 1)
          AND check_in_time < make_date($2 + 1, 1, 1)`,
      [workerId, year],
    );
    const hours = Math.round((Number(row?.mins || 0) / 60) * 100) / 100;
    // Clamped: once the cap is reached there is nothing left, and a negative
    // "remaining" reads as nonsense in the refusal message.
    const remainingHours = Math.max(0, Math.round((capHours - hours) * 100) / 100);
    return { year, hours, capHours, remainingHours };
  }

  @Cron('7 */2 * * *')
  async sweepCron() {
    if (process.env.OVERTIME_SWEEP_ENABLED === 'false') return;
    if (this.running) return;
    this.running = true;
    try {
      const n = await this.sweep();
      if (n) this.logger.log(`overtime recorded for ${n} sessions`);
    } catch (e: any) {
      this.logger.error(`overtime sweep failed: ${e.message}`);
    } finally {
      this.running = false;
    }
  }

  /**
   * Fills in every closed session whose overtime is missing or whose times
   * have changed since it was worked out. An approved figure is left alone —
   * a correction after approval is a decision for a person, not a sweep.
   */
  async sweep(limit = 500): Promise<number> {
    const rows: Array<{ id: number; job_id: number; check_in_time: Date; total_work_minutes: number }> =
      await this.dataSource.query(
        `SELECT id, job_id, check_in_time, total_work_minutes
           FROM work_sessions
          WHERE check_out_time IS NOT NULL
            AND (review_status IS NULL OR review_status = 'CONFIRMED')
            AND (overtime_status IS NULL OR overtime_status = 'PENDING')
            AND (overtime_basis_minutes IS DISTINCT FROM total_work_minutes)
          ORDER BY check_in_time DESC
          LIMIT $1`,
        [limit],
      );
    if (!rows.length) return 0;

    const jobs = new Map<number, Job | null>();
    let done = 0;
    for (const r of rows) {
      if (!jobs.has(r.job_id)) {
        jobs.set(
          r.job_id,
          await this.jobRepo.findOne({
            where: { id: r.job_id },
            relations: ['seasonalSchedules', 'seasonalSchedules.shifts'],
          }),
        );
      }
      const job = jobs.get(r.job_id);
      if (!job) continue;

      const scheduled = this.schedule.getScheduledMinutesForDate(job, new Date(r.check_in_time)) || 0;
      const d = this.decide(this.hasSchedule(job), scheduled, r.total_work_minutes);
      await this.dataSource.query(
        `UPDATE work_sessions
            SET overtime_minutes = $1, overtime_basis_minutes = $2, overtime_status = $3
          WHERE id = $4`,
        [d.minutes, d.basisMinutes, d.status, r.id],
      );
      done++;
    }
    return done;
  }
}
