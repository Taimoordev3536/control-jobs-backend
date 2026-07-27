import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { isUUID } from 'class-validator';
import { AttendancePolicy } from './entities/attendance-policy.entity';
import { UpdateAttendancePolicyDto } from './dto/update-attendance-policy.dto';
import { Job } from '../job/entities/job.entity';
import { Worker } from '../workers/entities/worker.entity';
import { EmployerUser } from '../employers/entities/employer-user.entity';
import { EmployerWorker } from '../employers/entities/employer-worker.entity';
import { User } from '../users/entities/user.entity';
import { UserRole } from '../auth/enums/user-role.enum';
import { SubUserPermission } from '../auth/enums/sub-user-permission.enum';

export interface ActorContext {
  id: number;
  subUser?: { isSubUser?: boolean; permission?: SubUserPermission | string };
}

export const POLICY_FIELDS = [
  'extraHoursAllowed',
  'closeAfterShiftEndMins',
  'recordScheduledEnd',
  'extraHoursWaitMins',
  'notifyWorkerAfterMins',
  'notifyEmployerAfterMins',
  'freeNotifyWorkerMins',
  'freeNotifyEmployerMins',
  'freeCloseAfterMins',
  'earlyCheckinMins',
  'countEarlyCheckin',
  'overtimeRequiresApproval',
  'overtimeAnnualCapHours',
  'overtimeRateMultiplier',
  'overtimeDefaultCompensation',
] as const;

export type EffectivePolicy = {
  extraHoursAllowed: boolean;
  closeAfterShiftEndMins: number;
  recordScheduledEnd: boolean;
  extraHoursWaitMins: number;
  notifyWorkerAfterMins: number;
  notifyEmployerAfterMins: number;
  freeNotifyWorkerMins: number;
  freeNotifyEmployerMins: number;
  freeCloseAfterMins: number;
  earlyCheckinMins: number;
  countEarlyCheckin: boolean;
  overtimeRequiresApproval: boolean;
  overtimeAnnualCapHours: number;
  overtimeRateMultiplier: number;
  overtimeDefaultCompensation: 'PAID' | 'TIME_OFF';
};

/** What a company gets before anyone configures anything. */
export const POLICY_DEFAULTS = (): EffectivePolicy => ({
  extraHoursAllowed: true,
  closeAfterShiftEndMins: 30,
  recordScheduledEnd: true,
  extraHoursWaitMins: 4 * 60,
  notifyWorkerAfterMins: 30,
  notifyEmployerAfterMins: 2 * 60,
  freeNotifyWorkerMins: 10 * 60,
  freeNotifyEmployerMins: 12 * 60,
  freeCloseAfterMins: 14 * 60,
  earlyCheckinMins: 30,
  countEarlyCheckin: false,
  overtimeRequiresApproval: true,
  // Art. 35.2 ET. The real figure comes from the convenio, so it is a setting.
  overtimeAnnualCapHours: 80,
  overtimeRateMultiplier: 1,
  // Art. 35.1 ET: absent an agreement, overtime is compensated with rest.
  overtimeDefaultCompensation: 'TIME_OFF',
});

@Injectable()
export class AttendancePolicyService {
  constructor(
    @InjectRepository(AttendancePolicy)
    private readonly policyRepo: Repository<AttendancePolicy>,
    @InjectRepository(Job)
    private readonly jobRepo: Repository<Job>,
    @InjectRepository(Worker)
    private readonly workerRepo: Repository<Worker>,
    @InjectRepository(EmployerUser)
    private readonly employerUserRepo: Repository<EmployerUser>,
    @InjectRepository(EmployerWorker)
    private readonly employerWorkerRepo: Repository<EmployerWorker>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
  ) {}

  // ─── Resolution ───────────────────────────────────────────────────

  /**
   * Employer, then job, then worker — each overriding only the fields it sets.
   * `workerId` is optional because some callers only know the job.
   */
  async resolve(jobId: number, workerId?: number): Promise<EffectivePolicy> {
    const job = await this.jobRepo.findOne({ where: { id: jobId }, relations: ['employer'] });
    const layers: (AttendancePolicy | null)[] = [];

    if (job?.employer?.id) {
      layers.push(await this.policyRepo.findOne({ where: { employerId: job.employer.id } }));
    }
    layers.push(await this.policyRepo.findOne({ where: { jobId } }));
    if (workerId) {
      layers.push(await this.policyRepo.findOne({ where: { workerId } }));
    }

    const effective = POLICY_DEFAULTS();
    for (const layer of layers) {
      if (!layer) continue;
      for (const field of POLICY_FIELDS) {
        const value = (layer as any)[field];
        if (value !== null && value !== undefined) (effective as any)[field] = value;
      }
    }
    return effective;
  }

  // ─── Authorization ────────────────────────────────────────────────

  private async roleOf(userId: number): Promise<string> {
    const user = await this.userRepo.findOne({ where: { id: userId }, relations: ['role'] });
    if (!user) throw new NotFoundException('User not found');
    switch (user.role.value) {
      case UserRole.Admin: return 'ADMIN';
      case UserRole.Employer: return 'EMPLOYER';
      case UserRole.Client: return 'CLIENT';
      case UserRole.Worker: return 'WORKER';
      default: return 'UNKNOWN';
    }
  }

  private async employerIdOf(userId: number): Promise<number | null> {
    const eu = await this.employerUserRepo.findOne({
      where: { user: { id: userId } },
      relations: ['employer'],
    });
    return eu?.employer?.id ?? null;
  }

  /** Only the employer who owns the scope (or an admin) may write these rules. */
  private async assertMayWrite(actor: ActorContext, scope: { jobId?: number; workerId?: number }): Promise<number | null> {
    const role = await this.roleOf(actor.id);
    const sub = actor.subUser;
    if (sub?.isSubUser && sub.permission !== SubUserPermission.ADMIN) {
      throw new ForbiddenException('Sub-users are not allowed to change attendance rules');
    }
    if (role === 'ADMIN') return null;
    if (role !== 'EMPLOYER') {
      throw new ForbiddenException('Only employers can change attendance rules');
    }
    const employerId = await this.employerIdOf(actor.id);
    if (!employerId) throw new ForbiddenException('Not an employer');

    if (scope.jobId) {
      const job = await this.jobRepo.findOne({ where: { id: scope.jobId }, relations: ['employer'] });
      if (!job) throw new NotFoundException('Job not found');
      if (job.employer?.id !== employerId) {
        throw new ForbiddenException('You do not have access to this job');
      }
    }
    if (scope.workerId) {
      const link = await this.employerWorkerRepo.findOne({
        where: { worker: { id: scope.workerId }, employer: { id: employerId } },
      });
      if (!link) throw new ForbiddenException('You do not have access to this worker');
    }
    return employerId;
  }

  // ─── Read ─────────────────────────────────────────────────────────

  async getForEmployer(actor: ActorContext): Promise<AttendancePolicy | null> {
    const employerId = await this.employerIdOf(actor.id);
    if (!employerId) throw new ForbiddenException('Not an employer');
    return this.policyRepo.findOne({ where: { employerId } });
  }

  async getForJob(jobPublicId: string, actor: ActorContext): Promise<AttendancePolicy | null> {
    const jobId = await this.resolveJobId(jobPublicId);
    await this.assertMayWrite(actor, { jobId });
    return this.policyRepo.findOne({ where: { jobId } });
  }

  async getForWorker(workerPublicId: string, actor: ActorContext): Promise<AttendancePolicy | null> {
    const workerId = await this.resolveWorkerId(workerPublicId);
    await this.assertMayWrite(actor, { workerId });
    return this.policyRepo.findOne({ where: { workerId } });
  }

  async resolveForJob(jobPublicId: string, actor: ActorContext, workerPublicId?: string): Promise<EffectivePolicy> {
    const jobId = await this.resolveJobId(jobPublicId);
    await this.assertMayWrite(actor, { jobId });
    const workerId = workerPublicId ? await this.resolveWorkerId(workerPublicId) : undefined;
    return this.resolve(jobId, workerId);
  }

  // ─── Write ────────────────────────────────────────────────────────

  async upsertForEmployer(dto: UpdateAttendancePolicyDto, actor: ActorContext): Promise<AttendancePolicy> {
    await this.assertMayWrite(actor, {});
    const employerId = await this.employerIdOf(actor.id);
    if (!employerId) throw new ForbiddenException('Not an employer');
    return this.upsert({ employerId }, dto);
  }

  async upsertForJob(jobPublicId: string, dto: UpdateAttendancePolicyDto, actor: ActorContext): Promise<AttendancePolicy> {
    const jobId = await this.resolveJobId(jobPublicId);
    await this.assertMayWrite(actor, { jobId });
    return this.upsert({ jobId }, dto);
  }

  async upsertForWorker(workerPublicId: string, dto: UpdateAttendancePolicyDto, actor: ActorContext): Promise<AttendancePolicy> {
    const workerId = await this.resolveWorkerId(workerPublicId);
    await this.assertMayWrite(actor, { workerId });
    return this.upsert({ workerId }, dto);
  }

  /** Drop an override so the level falls back to inheriting. */
  async clearForJob(jobPublicId: string, actor: ActorContext): Promise<void> {
    const jobId = await this.resolveJobId(jobPublicId);
    await this.assertMayWrite(actor, { jobId });
    await this.policyRepo.delete({ jobId });
  }

  async clearForWorker(workerPublicId: string, actor: ActorContext): Promise<void> {
    const workerId = await this.resolveWorkerId(workerPublicId);
    await this.assertMayWrite(actor, { workerId });
    await this.policyRepo.delete({ workerId });
  }

  private async upsert(scope: Partial<AttendancePolicy>, dto: UpdateAttendancePolicyDto): Promise<AttendancePolicy> {
    let row = await this.policyRepo.findOne({ where: scope as any });
    if (!row) row = this.policyRepo.create(scope);
    // Only assign what was sent; anything absent stays NULL and keeps inheriting.
    for (const field of POLICY_FIELDS) {
      if (field in dto) (row as any)[field] = (dto as any)[field];
    }
    return this.policyRepo.save(row);
  }

  // ─── Helpers ──────────────────────────────────────────────────────

  private async resolveJobId(idOrPublicId: string): Promise<number> {
    const where = isUUID(idOrPublicId) ? { publicId: idOrPublicId } : { id: Number(idOrPublicId) };
    if (!isUUID(idOrPublicId) && isNaN(Number(idOrPublicId))) throw new NotFoundException('Job not found');
    const job = await this.jobRepo.findOne({ where: where as any });
    if (!job) throw new NotFoundException('Job not found');
    return job.id;
  }

  private async resolveWorkerId(idOrPublicId: string): Promise<number> {
    const where = isUUID(idOrPublicId) ? { publicId: idOrPublicId } : { id: Number(idOrPublicId) };
    if (!isUUID(idOrPublicId) && isNaN(Number(idOrPublicId))) throw new NotFoundException('Worker not found');
    const worker = await this.workerRepo.findOne({ where: where as any });
    if (!worker) throw new NotFoundException('Worker not found');
    return worker.id;
  }
}
