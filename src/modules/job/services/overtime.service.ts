import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Cron } from '@nestjs/schedule';
import { WorkSession } from '../entities/work-session.entity';
import { Job } from '../entities/job.entity';
import { JobScheduleService } from './job-schedule.service';
import { ScheduleType } from '../entities/schedule-type.enum';

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
    private readonly schedule: JobScheduleService,
    private readonly dataSource: DataSource,
  ) {}

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
    return { year, hours, capHours, remainingHours: Math.round((capHours - hours) * 100) / 100 };
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
