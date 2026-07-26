import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { Cron } from '@nestjs/schedule';
import { WorkSession, SessionReviewStatus } from '../entities/work-session.entity';
import { ScanLog } from '../entities/scan-log.entity';
import { Job } from '../entities/job.entity';
import { ScheduleType } from '../entities/schedule-type.enum';
import { JobScheduleService } from './job-schedule.service';
import { AttendancePolicyService, EffectivePolicy } from '../../attendance-policy/attendance-policy.service';
import { AlertsService } from '../../realtime/alerts.service';
import { EmployerUser } from '../../employers/entities/employer-user.entity';
import { WorkerUser } from '../../workers/entities/worker-user.entity';

export type WatchdogAction =
  | { kind: 'none' }
  | { kind: 'notify-worker' }
  | { kind: 'notify-employer' }
  | { kind: 'close'; at: Date; status: SessionReviewStatus; recordHours: boolean };

/**
 * Chases sessions nobody closed: reminds the worker, then the employer, then
 * closes so the worker is not blocked tomorrow.
 *
 * A closed session never carries invented hours. On a scheduled job it records
 * the shift's own end, marked NEEDS_CONFIRMATION. On a free job there is
 * nothing to guess from, so the hours are left at zero and marked NEEDS_TIME.
 * Neither counts towards pay until a human settles it.
 */
@Injectable()
export class SessionWatchdogService {
  private readonly logger = new Logger(SessionWatchdogService.name);
  private running = false;

  constructor(
    @InjectRepository(WorkSession) private readonly sessionRepo: Repository<WorkSession>,
    @InjectRepository(ScanLog) private readonly scanLogRepo: Repository<ScanLog>,
    @InjectRepository(Job) private readonly jobRepo: Repository<Job>,
    @InjectRepository(EmployerUser) private readonly employerUserRepo: Repository<EmployerUser>,
    @InjectRepository(WorkerUser) private readonly workerUserRepo: Repository<WorkerUser>,
    private readonly schedule: JobScheduleService,
    private readonly policies: AttendancePolicyService,
    private readonly alerts: AlertsService,
  ) {}

  /**
   * The whole decision, with no I/O so it can be tested directly.
   *
   * `shiftEnd` is null for a free job or a scheduled one with no shift that day.
   */
  decide(args: {
    now: Date;
    checkIn: Date;
    shiftEnd: Date | null;
    policy: EffectivePolicy;
    workerNotified: boolean;
    employerNotified: boolean;
  }): WatchdogAction {
    const { now, checkIn, shiftEnd, policy } = args;
    const mins = (from: Date) => (now.getTime() - from.getTime()) / 60000;

    if (shiftEnd) {
      const since = mins(shiftEnd);
      if (since < 0) return { kind: 'none' };

      const closeAfter = policy.extraHoursAllowed
        ? policy.extraHoursWaitMins
        : policy.closeAfterShiftEndMins;

      if (since >= closeAfter) {
        return {
          kind: 'close',
          // Record the shift's end, not the moment we noticed.
          at: policy.recordScheduledEnd ? shiftEnd : now,
          status: SessionReviewStatus.NEEDS_CONFIRMATION,
          recordHours: true,
        };
      }
      // Only chase when extra hours are allowed; otherwise the close is
      // imminent anyway and a reminder is noise.
      if (policy.extraHoursAllowed) {
        if (!args.employerNotified && since >= policy.notifyEmployerAfterMins) {
          return { kind: 'notify-employer' };
        }
        if (!args.workerNotified && since >= policy.notifyWorkerAfterMins) {
          return { kind: 'notify-worker' };
        }
      } else if (!args.workerNotified && since >= Math.min(15, closeAfter)) {
        return { kind: 'notify-worker' };
      }
      return { kind: 'none' };
    }

    // No shift to measure against: everything runs from the check-in.
    const open = mins(checkIn);
    if (open >= policy.freeCloseAfterMins) {
      return {
        kind: 'close',
        at: now,
        status: SessionReviewStatus.NEEDS_TIME,
        recordHours: false,
      };
    }
    if (!args.employerNotified && open >= policy.freeNotifyEmployerMins) {
      return { kind: 'notify-employer' };
    }
    if (!args.workerNotified && open >= policy.freeNotifyWorkerMins) {
      return { kind: 'notify-worker' };
    }
    return { kind: 'none' };
  }

  /** The moment the shift covering this check-in was due to end. */
  async shiftEndFor(job: Job, checkIn: Date): Promise<Date | null> {
    if (job.scheduleType === ScheduleType.FREE) return null;
    const occurrences = this.schedule.getShiftOccurrencesAround(job, checkIn);
    if (!occurrences.length) return null;
    // The shift the worker actually started: the latest one that had begun.
    const started = occurrences
      .filter((o) => o.start.getTime() <= checkIn.getTime() + 60 * 60_000)
      .sort((a, b) => b.start.getTime() - a.start.getTime());
    return (started[0] ?? occurrences[0]).end;
  }

  @Cron('*/15 * * * *', { name: 'session-watchdog' })
  async tick(): Promise<void> {
    if (process.env.SESSION_WATCHDOG_ENABLED === 'false') return;
    if (this.running) return;
    this.running = true;
    try {
      await this.sweep(new Date());
    } catch (e: any) {
      this.logger.error(`sweep failed: ${e?.message ?? e}`);
    } finally {
      this.running = false;
    }
  }

  async sweep(now: Date): Promise<{ notified: number; closed: number }> {
    const open = await this.sessionRepo.find({ where: { checkOutTime: IsNull() } });
    let notified = 0;
    let closed = 0;

    for (const session of open) {
      try {
        const job = await this.jobRepo.findOne({
          where: { id: session.jobId },
          relations: ['employer', 'seasonalSchedules', 'seasonalSchedules.shifts'],
        });
        if (!job) continue;

        const policy = await this.policies.resolve(session.jobId, session.workerId);
        const shiftEnd = await this.shiftEndFor(job, session.checkInTime);
        const action = this.decide({
          now,
          checkIn: session.checkInTime,
          shiftEnd,
          policy,
          workerNotified: !!session.workerNotifiedAt,
          employerNotified: !!session.employerNotifiedAt,
        });

        if (action.kind === 'notify-worker') {
          await this.notifyWorker(session, job);
          session.workerNotifiedAt = now;
          await this.sessionRepo.save(session);
          notified++;
        } else if (action.kind === 'notify-employer') {
          await this.notifyEmployer(session, job);
          session.employerNotifiedAt = now;
          await this.sessionRepo.save(session);
          notified++;
        } else if (action.kind === 'close') {
          await this.close(session, job, action, now);
          closed++;
        }
      } catch (e: any) {
        this.logger.error(`session ${session.id}: ${e?.message ?? e}`);
      }
    }
    if (notified || closed) {
      this.logger.log(`watchdog: notified ${notified}, closed ${closed}`);
    }
    return { notified, closed };
  }

  private async close(
    session: WorkSession,
    job: Job,
    action: Extract<WatchdogAction, { kind: 'close' }>,
    now: Date,
  ): Promise<void> {
    session.checkOutTime = action.at;
    session.checkOutMethod = 'auto';
    session.source = 'AUTO';
    session.isActive = false;
    session.isOnBreak = false;
    session.autoClosedAt = now;
    session.reviewStatus = action.status;

    if (action.recordHours) {
      const mins = Math.max(
        0,
        Math.round((action.at.getTime() - session.checkInTime.getTime()) / 60000) -
          (session.totalBreakMinutes || 0),
      );
      session.totalWorkMinutes = mins;
    } else {
      // Free job: nothing to base a number on, so leave it blank.
      session.totalWorkMinutes = 0;
    }
    await this.sessionRepo.save(session);

    await this.scanLogRepo.save(
      this.scanLogRepo.create({
        jobId: session.jobId,
        workerId: session.workerId,
        workCenterId: session.workCenterId,
        workSessionId: session.id,
        scanType: 'check-out',
        scanTime: action.at,
        signingMethod: 'auto',
        source: 'AUTO',
        notes:
          action.status === SessionReviewStatus.NEEDS_TIME
            ? 'Closed automatically. The real end time still has to be entered.'
            : 'Closed automatically at the scheduled shift end. Needs confirmation.',
      }),
    );

    await this.emit(session, job, 'SESSION_AUTO_CLOSED', 'Session closed automatically — please review');
  }

  private async notifyWorker(session: WorkSession, job: Job): Promise<void> {
    const wu = await this.workerUserRepo.findOne({ where: { workerId: session.workerId } });
    if (!wu?.userId) return;
    await this.alerts.createAndEmitForUser({
      userId: wu.userId,
      role: 'WORKER',
      type: 'SESSION_STILL_OPEN' as any,
      message: `You are still checked in on ${job.jobName}. Did you finish?`,
      meta: { workSessionId: session.publicId, jobPublicId: job.publicId },
    });
  }

  private async notifyEmployer(session: WorkSession, job: Job): Promise<void> {
    await this.emit(session, job, 'SESSION_STILL_OPEN', `A worker is still checked in on ${job.jobName}`);
  }

  private async emit(session: WorkSession, job: Job, type: string, message: string): Promise<void> {
    const eu = await this.employerUserRepo.findOne({
      where: { employer: { id: job.employer?.id } },
      relations: ['user'],
    });
    if (!eu?.user?.id) return;
    await this.alerts.createAndEmitForUser({
      userId: eu.user.id,
      role: 'EMPLOYER',
      type: type as any,
      message,
      meta: { workSessionId: session.publicId, jobPublicId: job.publicId },
    });
  }
}
