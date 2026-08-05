import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, IsNull, Not, Repository } from 'typeorm';
import { WorkSession, SessionReviewStatus, UNSETTLED_REVIEW_STATUSES } from '../entities/work-session.entity';
import { ScanLog } from '../entities/scan-log.entity';
import { Job } from '../entities/job.entity';
import { EmployerUser } from '../../employers/entities/employer-user.entity';
import { WorkerUser } from '../../workers/entities/worker-user.entity';
import { ClientUser } from '../../clients/entities/client-user.entity';
import { User } from '../../users/entities/user.entity';
import { UserRole } from '../../auth/enums/user-role.enum';

export type Viewer = 'EMPLOYER' | 'WORKER' | 'CLIENT' | 'ADMIN';

@Injectable()
export class SessionReviewService {
  constructor(
    @InjectRepository(WorkSession) private readonly sessionRepo: Repository<WorkSession>,
    @InjectRepository(ScanLog) private readonly scanLogRepo: Repository<ScanLog>,
    @InjectRepository(Job) private readonly jobRepo: Repository<Job>,
    @InjectRepository(EmployerUser) private readonly employerUserRepo: Repository<EmployerUser>,
    @InjectRepository(WorkerUser) private readonly workerUserRepo: Repository<WorkerUser>,
    @InjectRepository(ClientUser) private readonly clientUserRepo: Repository<ClientUser>,
    @InjectRepository(User) private readonly userRepo: Repository<User>,
  ) {}

  private async roleOf(userId: number): Promise<Viewer> {
    const user = await this.userRepo.findOne({ where: { id: userId }, relations: ['role'] });
    if (!user) throw new NotFoundException('User not found');
    switch (user.role.value) {
      case UserRole.Admin: return 'ADMIN';
      case UserRole.Employer: return 'EMPLOYER';
      case UserRole.Client: return 'CLIENT';
      default: return 'WORKER';
    }
  }

  /**
   * Who may see a session, and whether they may settle it.
   *
   * The client can watch — the work is theirs — but not decide. In Spain the
   * employer carries the record, so a client closing someone else's worker's
   * day would put the liability in the wrong place.
   */
  private async access(userId: number, session: WorkSession): Promise<{ role: Viewer; canSettle: boolean }> {
    const role = await this.roleOf(userId);
    if (role === 'ADMIN') return { role, canSettle: true };

    const job = await this.jobRepo.findOne({
      where: { id: session.jobId },
      relations: ['employer', 'client'],
    });
    if (!job) throw new NotFoundException('Job not found');

    if (role === 'EMPLOYER') {
      const eu = await this.employerUserRepo.findOne({ where: { user: { id: userId } }, relations: ['employer'] });
      if (eu?.employer?.id && eu.employer.id === job.employer?.id) return { role, canSettle: true };
    }
    if (role === 'WORKER') {
      const wu = await this.workerUserRepo.findOne({ where: { userId } });
      if (wu?.workerId === session.workerId) return { role, canSettle: true };
    }
    if (role === 'CLIENT') {
      const cu = await this.clientUserRepo.findOne({ where: { userId } });
      if (cu?.clientId && cu.clientId === job.client?.id) return { role, canSettle: false };
    }
    throw new ForbiddenException('You do not have access to this session');
  }

  /** Everything waiting on a human, scoped to what the caller may see. */
  async list(userId: number): Promise<WorkSession[]> {
    const role = await this.roleOf(userId);
    const qb = this.sessionRepo
      .createQueryBuilder('ws')
      .leftJoinAndSelect('ws.job', 'job')
      .leftJoinAndSelect('ws.worker', 'worker')
      .leftJoin('job.employer', 'employer')
      .leftJoin('job.client', 'client')
      .where('ws.review_status IN (:...statuses)', { statuses: UNSETTLED_REVIEW_STATUSES })
      .orderBy('ws.check_in_time', 'DESC');

    if (role === 'EMPLOYER') {
      const eu = await this.employerUserRepo.findOne({ where: { user: { id: userId } }, relations: ['employer'] });
      qb.andWhere('employer.id = :id', { id: eu?.employer?.id ?? -1 });
    } else if (role === 'CLIENT') {
      const cu = await this.clientUserRepo.findOne({ where: { userId } });
      qb.andWhere('client.id = :id', { id: cu?.clientId ?? -1 });
    } else if (role === 'WORKER') {
      const wu = await this.workerUserRepo.findOne({ where: { userId } });
      qb.andWhere('ws.worker_id = :id', { id: wu?.workerId ?? -1 });
    }
    const rows = await qb.getMany();
    // Worker names live on the workers_users junction, not worker.user_id, so
    // without this the queue shows bare codes — the same fix the overtime
    // queue needed.
    const names = await this.resolveWorkerNames(rows.map((r) => r.workerId));
    return rows.map((r) => ({
      ...r,
      worker: { ...(r.worker as any), name: names.get(r.workerId) ?? (r.worker as any)?.code ?? null },
    })) as any;
  }

  private async resolveWorkerNames(workerIds: (number | null | undefined)[]): Promise<Map<number, string>> {
    const names = new Map<number, string>();
    const ids = Array.from(new Set(workerIds.filter((id): id is number => id != null)));
    if (!ids.length) return names;
    const links = await this.workerUserRepo.find({
      where: ids.map((id) => ({ workerId: id })),
      relations: ['user'],
    });
    for (const l of links as any[]) {
      if (l.workerId && l.user?.name) names.set(l.workerId, l.user.name);
    }
    return names;
  }

  async get(publicId: string, userId: number) {
    const session = await this.sessionRepo.findOne({
      where: { publicId },
      relations: ['job', 'worker'],
    });
    if (!session) throw new NotFoundException('Session not found');
    const { role, canSettle } = await this.access(userId, session);
    return { session, role, canSettle };
  }

  /** Accept the time the system recorded. Only offered where there is one. */
  async confirm(publicId: string, userId: number): Promise<WorkSession> {
    const session = await this.sessionRepo.findOne({ where: { publicId } });
    if (!session) throw new NotFoundException('Session not found');
    const { canSettle } = await this.access(userId, session);
    if (!canSettle) throw new ForbiddenException('Only the employer or the worker can settle this');
    if (session.reviewStatus !== SessionReviewStatus.NEEDS_CONFIRMATION) {
      throw new BadRequestException(
        session.reviewStatus === SessionReviewStatus.NEEDS_TIME
          ? 'This session has no recorded end time — enter the real one instead'
          : 'This session does not need review',
      );
    }
    session.reviewStatus = SessionReviewStatus.CONFIRMED;
    session.reviewedByUserId = userId;
    session.reviewedAt = new Date();
    return this.sessionRepo.save(session);
  }

  /** Give the real end time. The only option where the system had no guess. */
  async correct(publicId: string, userId: number, checkOutTime: Date, note?: string): Promise<WorkSession> {
    const session = await this.sessionRepo.findOne({ where: { publicId } });
    if (!session) throw new NotFoundException('Session not found');
    const { canSettle } = await this.access(userId, session);
    if (!canSettle) throw new ForbiddenException('Only the employer or the worker can settle this');
    // Only a session the system flagged may be settled here. Without this a
    // worker could rewrite any of their own past records — including ones
    // already confirmed, paid and invoiced — bypassing the manual-attendance
    // request and approval flow entirely.
    if (!UNSETTLED_REVIEW_STATUSES.includes(session.reviewStatus as SessionReviewStatus)) {
      throw new BadRequestException(
        'This session is not awaiting review. Use a manual attendance request to correct it.',
      );
    }
    if (Number.isNaN(checkOutTime.getTime())) {
      throw new BadRequestException('A valid end time is required');
    }
    if (checkOutTime.getTime() <= session.checkInTime.getTime()) {
      throw new BadRequestException('The end time must be after the check-in');
    }
    const minutes = Math.round((checkOutTime.getTime() - session.checkInTime.getTime()) / 60000);
    if (minutes > 24 * 60) {
      throw new BadRequestException('A single session cannot exceed 24 hours');
    }

    session.checkOutTime = checkOutTime;
    session.totalWorkMinutes = Math.max(0, minutes - (session.totalBreakMinutes || 0));
    session.reviewStatus = SessionReviewStatus.CONFIRMED;
    session.reviewedByUserId = userId;
    session.reviewedAt = new Date();
    session.source = 'MANUAL';
    if (note) session.notes = `${session.notes ?? ''}\n${note}`.trim();
    await this.sessionRepo.save(session);

    await this.scanLogRepo.update(
      { workSessionId: session.id, scanType: 'check-out' },
      { scanTime: checkOutTime, source: 'MANUAL', signingMethod: 'manual' },
    );
    return session;
  }

  /**
   * Close a session that is still open, by hand. Nothing could do this before,
   * so a forgotten check-out left the worker unable to start again.
   */
  async forceClose(publicId: string, userId: number, checkOutTime?: Date): Promise<WorkSession> {
    const session = await this.sessionRepo.findOne({ where: { publicId } });
    if (!session) throw new NotFoundException('Session not found');
    const { role, canSettle } = await this.access(userId, session);
    if (!canSettle || role === 'WORKER') {
      throw new ForbiddenException('Only the employer or an admin can force a session closed');
    }
    if (session.checkOutTime) throw new BadRequestException('This session is already closed');

    const at = checkOutTime ?? new Date();
    if (at.getTime() <= session.checkInTime.getTime()) {
      throw new BadRequestException('The end time must be after the check-in');
    }
    session.checkOutTime = at;
    session.checkOutMethod = 'manual';
    session.isActive = false;
    session.isOnBreak = false;
    session.source = 'MANUAL';
    session.reviewStatus = checkOutTime ? SessionReviewStatus.CONFIRMED : SessionReviewStatus.NEEDS_TIME;
    session.reviewedByUserId = userId;
    session.reviewedAt = new Date();
    session.totalWorkMinutes = checkOutTime
      ? Math.max(0, Math.round((at.getTime() - session.checkInTime.getTime()) / 60000) - (session.totalBreakMinutes || 0))
      : 0;
    return this.sessionRepo.save(session);
  }

  async countPending(userId: number): Promise<number> {
    return (await this.list(userId)).length;
  }
}
