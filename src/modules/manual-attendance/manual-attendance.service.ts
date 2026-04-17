import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, Between, MoreThanOrEqual, LessThanOrEqual, In } from 'typeorm';
import { isUUID } from 'class-validator';
import { ManualAttendanceRequest } from './entities/manual-attendance-request.entity';
import { ManualAttendancePermission } from './entities/manual-attendance-permission.entity';
import { ManualAttendanceRequestType } from './enums/request-type.enum';
import { ManualAttendanceRequestStatus } from './enums/request-status.enum';
import { CreateManualAttendanceRequestDto } from './dto/create-manual-attendance-request.dto';
import { ReviewManualAttendanceRequestDto } from './dto/review-manual-attendance-request.dto';
import { UpdateManualAttendancePermissionDto } from './dto/update-manual-attendance-permission.dto';
import { QueryManualAttendanceRequestsDto } from './dto/query-manual-attendance-requests.dto';
import { Job } from '../job/entities/job.entity';
import { Worker } from '../workers/entities/worker.entity';
import { WorkCenter } from '../work-centers/entities/work-center.entity';
import { WorkSession } from '../job/entities/work-session.entity';
import { ScanLog } from '../job/entities/scan-log.entity';
import { EmployerUser } from '../employers/entities/employer-user.entity';
import { WorkerUser } from '../workers/entities/worker-user.entity';
import { ClientUser } from '../clients/entities/client-user.entity';
import { User } from '../users/entities/user.entity';
import { UserRole } from '../auth/enums/user-role.enum';
import { AlertsService } from '../realtime/alerts.service';

@Injectable()
export class ManualAttendanceService {
  constructor(
    @InjectRepository(ManualAttendanceRequest)
    private readonly requestRepo: Repository<ManualAttendanceRequest>,
    @InjectRepository(ManualAttendancePermission)
    private readonly permissionRepo: Repository<ManualAttendancePermission>,
    @InjectRepository(Job)
    private readonly jobRepo: Repository<Job>,
    @InjectRepository(Worker)
    private readonly workerRepo: Repository<Worker>,
    @InjectRepository(WorkCenter)
    private readonly workCenterRepo: Repository<WorkCenter>,
    @InjectRepository(WorkSession)
    private readonly workSessionRepo: Repository<WorkSession>,
    @InjectRepository(ScanLog)
    private readonly scanLogRepo: Repository<ScanLog>,
    @InjectRepository(EmployerUser)
    private readonly employerUserRepo: Repository<EmployerUser>,
    @InjectRepository(WorkerUser)
    private readonly workerUserRepo: Repository<WorkerUser>,
    @InjectRepository(ClientUser)
    private readonly clientUserRepo: Repository<ClientUser>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    private readonly dataSource: DataSource,
    private readonly alertsService: AlertsService,
  ) {}

  // ─── Helper: resolve publicId to numeric id ───────────────────────

  private async resolveJobPublicId(idOrPublicId: string): Promise<number> {
    if (isUUID(idOrPublicId)) {
      const job = await this.jobRepo.findOne({ where: { publicId: idOrPublicId } });
      if (!job) throw new NotFoundException('Job not found');
      return job.id;
    }
    const numId = Number(idOrPublicId);
    if (!isNaN(numId)) {
      const job = await this.jobRepo.findOne({ where: { id: numId } });
      if (!job) throw new NotFoundException('Job not found');
      return job.id;
    }
    throw new NotFoundException('Job not found: invalid ID format');
  }

  private async resolveWorkerPublicId(idOrPublicId: string): Promise<number> {
    if (isUUID(idOrPublicId)) {
      const worker = await this.workerRepo.findOne({ where: { publicId: idOrPublicId } });
      if (!worker) throw new NotFoundException('Worker not found');
      return worker.id;
    }
    const numId = Number(idOrPublicId);
    if (!isNaN(numId)) {
      const worker = await this.workerRepo.findOne({ where: { id: numId } });
      if (!worker) throw new NotFoundException('Worker not found');
      return worker.id;
    }
    throw new NotFoundException('Worker not found: invalid ID format');
  }

  private async resolveWorkCenterPublicId(idOrPublicId: string): Promise<number> {
    if (isUUID(idOrPublicId)) {
      const wc = await this.workCenterRepo.findOne({ where: { publicId: idOrPublicId } });
      if (!wc) throw new NotFoundException('Work center not found');
      return wc.id;
    }
    const numId = Number(idOrPublicId);
    if (!isNaN(numId)) {
      const wc = await this.workCenterRepo.findOne({ where: { id: numId } });
      if (!wc) throw new NotFoundException('Work center not found');
      return wc.id;
    }
    throw new NotFoundException('Work center not found: invalid ID format');
  }

  private async resolveWorkSessionPublicId(idOrPublicId: string): Promise<number> {
    if (isUUID(idOrPublicId)) {
      const ws = await this.workSessionRepo.findOne({ where: { publicId: idOrPublicId } });
      if (!ws) throw new NotFoundException('Work session not found');
      return ws.id;
    }
    const numId = Number(idOrPublicId);
    if (!isNaN(numId)) {
      const ws = await this.workSessionRepo.findOne({ where: { id: numId } });
      if (!ws) throw new NotFoundException('Work session not found');
      return ws.id;
    }
    throw new NotFoundException('Work session not found: invalid ID format');
  }

  // ─── Helper: get user role string ─────────────────────────────────

  private async getUserRoleString(userId: number): Promise<string> {
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

  // ─── Helper: get employer ID for a user ───────────────────────────

  private async getEmployerIdForUser(userId: number): Promise<number | null> {
    const eu = await this.employerUserRepo.findOne({
      where: { user: { id: userId } },
      relations: ['employer'],
    });
    return eu?.employer?.id ?? null;
  }

  private async getClientIdForUser(userId: number): Promise<number | null> {
    const cu = await this.clientUserRepo.findOne({
      where: { userId },
      relations: ['client'],
    });
    return cu?.client?.id ?? null;
  }

  private async getWorkerIdForUser(userId: number): Promise<number | null> {
    const wu = await this.workerUserRepo.findOne({
      where: { userId },
      relations: ['worker'],
    });
    return wu?.worker?.id ?? null;
  }

  // ─── Permission Resolution (Job → Client → Employer hierarchy) ───

  async getEffectivePermissions(jobId: number): Promise<ManualAttendancePermission | null> {
    // 1. Job-level permission (most specific)
    const jobPerm = await this.permissionRepo.findOne({ where: { jobId } });
    if (jobPerm) return jobPerm;

    // 2. Load the job to find client/employer
    const job = await this.jobRepo.findOne({
      where: { id: jobId },
      relations: ['client', 'employer'],
    });
    if (!job) return null;

    // 3. Client-level permission
    if (job.client) {
      const clientPerm = await this.permissionRepo.findOne({ where: { clientId: job.client.id } });
      if (clientPerm) return clientPerm;
    }

    // 4. Employer-level permission
    const employerPerm = await this.permissionRepo.findOne({
      where: { employerId: job.employer.id },
    });
    if (employerPerm) return employerPerm;

    // 5. No permission configured - return default enabled settings
    // This allows the feature to work out of the box without requiring setup
    const defaults = new ManualAttendancePermission();
    defaults.isEnabled = true;
    defaults.workerCanRequest = true;
    defaults.employerCanCreate = true;
    defaults.clientCanCreate = true;
    defaults.maxRetroactiveDays = 7;
    defaults.maxRequestsPerWorkerMonth = 10;
    defaults.requireReason = true;
    return defaults;
  }

  async getEffectivePermissionsByJobPublicId(jobPublicId: string): Promise<ManualAttendancePermission | null> {
    const jobId = await this.resolveJobPublicId(jobPublicId);
    return this.getEffectivePermissions(jobId);
  }

  // ─── Permission CRUD ──────────────────────────────────────────────

  async getPermissionForEmployer(userId: number): Promise<ManualAttendancePermission | null> {
    const employerId = await this.getEmployerIdForUser(userId);
    if (!employerId) throw new ForbiddenException('Not an employer');
    return this.permissionRepo.findOne({ where: { employerId } });
  }

  async upsertPermissionForEmployer(userId: number, dto: UpdateManualAttendancePermissionDto): Promise<ManualAttendancePermission> {
    const employerId = await this.getEmployerIdForUser(userId);
    if (!employerId) throw new ForbiddenException('Not an employer');

    let perm = await this.permissionRepo.findOne({ where: { employerId } });
    if (!perm) {
      perm = this.permissionRepo.create({ employerId });
    }
    Object.assign(perm, dto);
    return this.permissionRepo.save(perm);
  }

  async getPermissionForClient(userId: number, clientPublicId?: string): Promise<ManualAttendancePermission | null> {
    const clientId = await this.getClientIdForUser(userId);
    if (!clientId) throw new ForbiddenException('Not a client');
    return this.permissionRepo.findOne({ where: { clientId } });
  }

  async upsertPermissionForClient(userId: number, dto: UpdateManualAttendancePermissionDto): Promise<ManualAttendancePermission> {
    const clientId = await this.getClientIdForUser(userId);
    if (!clientId) throw new ForbiddenException('Not a client');

    let perm = await this.permissionRepo.findOne({ where: { clientId } });
    if (!perm) {
      perm = this.permissionRepo.create({ clientId });
    }
    Object.assign(perm, dto);
    return this.permissionRepo.save(perm);
  }

  async getPermissionForJob(jobPublicId: string): Promise<ManualAttendancePermission | null> {
    const jobId = await this.resolveJobPublicId(jobPublicId);
    return this.permissionRepo.findOne({ where: { jobId } });
  }

  async upsertPermissionForJob(jobPublicId: string, dto: UpdateManualAttendancePermissionDto): Promise<ManualAttendancePermission> {
    const jobId = await this.resolveJobPublicId(jobPublicId);
    let perm = await this.permissionRepo.findOne({ where: { jobId } });
    if (!perm) {
      perm = this.permissionRepo.create({ jobId });
    }
    Object.assign(perm, dto);
    return this.permissionRepo.save(perm);
  }

  // ─── Create Request ───────────────────────────────────────────────

  async createRequest(dto: CreateManualAttendanceRequestDto, userId: number): Promise<ManualAttendanceRequest> {
    const userRole = await this.getUserRoleString(userId);

    // Resolve public IDs
    const jobId = await this.resolveJobPublicId(dto.jobId);

    // If worker role and no workerId provided, auto-resolve from JWT user
    let workerId: number;
    if (dto.workerId) {
      workerId = await this.resolveWorkerPublicId(dto.workerId);
    } else if (userRole === 'WORKER') {
      const resolvedWorkerId = await this.getWorkerIdForUser(userId);
      if (!resolvedWorkerId) throw new BadRequestException('Could not resolve worker for current user');
      workerId = resolvedWorkerId;
    } else {
      throw new BadRequestException('workerId is required for non-worker roles');
    }

    const workCenterId = dto.workCenterId ? await this.resolveWorkCenterPublicId(dto.workCenterId) : undefined;

    // Load job with relations to verify worker assignment
    const job = await this.jobRepo.findOne({
      where: { id: jobId },
      relations: ['workers', 'employer', 'client'],
    });
    if (!job) throw new NotFoundException('Job not found');

    // Verify worker is assigned to the job
    const workerAssigned = job.workers?.some(w => w.id === workerId);
    if (!workerAssigned) {
      throw new BadRequestException('Worker is not assigned to this job');
    }

    // Load effective permissions
    const permissions = await this.getEffectivePermissions(jobId);
    if (!permissions || !permissions.isEnabled) {
      throw new ForbiddenException('Manual attendance is not enabled for this job');
    }

    // Check role-based permission to create
    if (userRole === 'WORKER' && !permissions.workerCanRequest) {
      throw new ForbiddenException('Workers are not allowed to create manual attendance requests for this job');
    }
    if (userRole === 'EMPLOYER' && !permissions.employerCanCreate) {
      throw new ForbiddenException('Employer manual attendance creation is not enabled for this job');
    }
    if (userRole === 'CLIENT' && !permissions.clientCanCreate) {
      throw new ForbiddenException('Client manual attendance creation is not enabled for this job');
    }

    // If worker, verify they can only request for themselves
    if (userRole === 'WORKER') {
      const workerIdForUser = await this.getWorkerIdForUser(userId);
      if (workerIdForUser !== workerId) {
        throw new ForbiddenException('Workers can only create requests for themselves');
      }
    }

    // Validate retroactive date limit
    const requestedDate = new Date(dto.requestedDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const maxPastDate = new Date(today);
    maxPastDate.setDate(maxPastDate.getDate() - permissions.maxRetroactiveDays);

    if (requestedDate < maxPastDate) {
      throw new BadRequestException(
        `Cannot request attendance more than ${permissions.maxRetroactiveDays} days in the past`,
      );
    }

    if (requestedDate > today) {
      throw new BadRequestException('Cannot request attendance for a future date');
    }

    // Check monthly rate limit for this worker
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);
    const monthlyCount = await this.requestRepo.count({
      where: {
        workerId,
        createdAt: Between(startOfMonth, endOfMonth),
      },
    });
    if (monthlyCount >= permissions.maxRequestsPerWorkerMonth) {
      throw new BadRequestException(
        `Monthly request limit (${permissions.maxRequestsPerWorkerMonth}) reached for this worker`,
      );
    }

    // Check for duplicate pending/approved request
    const duplicate = await this.requestRepo.findOne({
      where: {
        jobId,
        workerId,
        requestedDate: requestedDate,
        status: ManualAttendanceRequestStatus.PENDING,
      },
    });
    if (duplicate) {
      throw new BadRequestException('A pending request already exists for this worker on this date');
    }

    // Validate reason if required
    if (permissions.requireReason && !dto.reason?.trim()) {
      throw new BadRequestException('A reason is required for manual attendance requests');
    }

    // Validate time sanity
    if (dto.requestedCheckIn && dto.requestedCheckOut) {
      const checkIn = new Date(dto.requestedCheckIn);
      const checkOut = new Date(dto.requestedCheckOut);
      if (checkOut <= checkIn) {
        throw new BadRequestException('Check-out time must be after check-in time');
      }
      const durationMs = checkOut.getTime() - checkIn.getTime();
      if (durationMs > 24 * 60 * 60 * 1000) {
        throw new BadRequestException('Attendance duration cannot exceed 24 hours');
      }
    }

    // For EDIT_EXISTING, load the original work session
    let existingWorkSessionId: number | undefined;
    let originalCheckIn: Date | undefined;
    let originalCheckOut: Date | undefined;
    if (dto.requestType === ManualAttendanceRequestType.EDIT_EXISTING) {
      if (!dto.existingWorkSessionId) {
        throw new BadRequestException('existingWorkSessionId is required for EDIT_EXISTING requests');
      }
      existingWorkSessionId = await this.resolveWorkSessionPublicId(dto.existingWorkSessionId);
      const existingSession = await this.workSessionRepo.findOne({ where: { id: existingWorkSessionId } });
      if (!existingSession) {
        throw new NotFoundException('The work session to edit was not found');
      }
      originalCheckIn = existingSession.checkInTime;
      originalCheckOut = existingSession.checkOutTime;
    }

    // For CHECK_OUT_ONLY, verify there's an open session
    if (dto.requestType === ManualAttendanceRequestType.CHECK_OUT_ONLY) {
      const openSession = await this.workSessionRepo.findOne({
        where: { jobId, workerId, checkOutTime: null as any },
      });
      if (!openSession) {
        throw new BadRequestException('No open work session found for this worker on this job');
      }
      existingWorkSessionId = openSession.id;
      originalCheckIn = openSession.checkInTime;
    }

    // Create the request
    const request = this.requestRepo.create({
      jobId,
      workerId,
      workCenterId,
      requestType: dto.requestType,
      status: ManualAttendanceRequestStatus.PENDING,
      requestedDate,
      requestedCheckIn: dto.requestedCheckIn ? new Date(dto.requestedCheckIn) : undefined,
      requestedCheckOut: dto.requestedCheckOut ? new Date(dto.requestedCheckOut) : undefined,
      existingWorkSessionId,
      originalCheckIn,
      originalCheckOut,
      reason: dto.reason,
      workerNotes: dto.workerNotes,
      requestedByUserId: userId,
      requestedByRole: userRole,
    });

    const saved = await this.requestRepo.save(request);

    // Send notification to employer/client
    await this.emitRequestNotification(saved, job, 'MANUAL_ATTENDANCE_REQUESTED');

    return saved;
  }

  // ─── Review Request (Approve / Reject) ────────────────────────────

  async reviewRequest(
    requestPublicId: string,
    dto: ReviewManualAttendanceRequestDto,
    userId: number,
  ): Promise<ManualAttendanceRequest> {
    const userRole = await this.getUserRoleString(userId);

    // Only employers and clients can review
    if (userRole !== 'EMPLOYER' && userRole !== 'CLIENT' && userRole !== 'ADMIN') {
      throw new ForbiddenException('Only employers, clients, or admins can review requests');
    }

    const request = await this.requestRepo.findOne({
      where: { publicId: requestPublicId },
      relations: ['job', 'job.employer', 'job.client', 'worker'],
    });
    if (!request) throw new NotFoundException('Request not found');

    if (request.status !== ManualAttendanceRequestStatus.PENDING) {
      throw new BadRequestException('This request has already been reviewed');
    }

    // Self-review block
    if (request.requestedByUserId === userId) {
      throw new ForbiddenException('You cannot review your own request');
    }

    if (dto.action === 'APPROVE') {
      await this.approveRequest(request, userId, userRole, dto.reviewerNotes);
    } else {
      request.status = ManualAttendanceRequestStatus.REJECTED;
      request.reviewedByUserId = userId;
      request.reviewedByRole = userRole;
      request.reviewedAt = new Date();
      request.reviewerNotes = dto.reviewerNotes;
      await this.requestRepo.save(request);
    }

    // Reload with relations
    const updated = await this.requestRepo.findOne({
      where: { id: request.id },
      relations: ['job', 'job.client', 'worker', 'worker.user', 'workCenter', 'resultWorkSession', 'requestedByUser', 'reviewedByUser'],
    });

    // Notify worker
    const notificationType = dto.action === 'APPROVE'
      ? 'MANUAL_ATTENDANCE_APPROVED'
      : 'MANUAL_ATTENDANCE_REJECTED';
    await this.emitRequestNotification(updated, updated.job, notificationType);

    return updated;
  }

  private async approveRequest(
    request: ManualAttendanceRequest,
    reviewerUserId: number,
    reviewerRole: string,
    reviewerNotes?: string,
  ): Promise<void> {
    await this.dataSource.transaction(async (txManager) => {
      const requestRepo = txManager.getRepository(ManualAttendanceRequest);
      const workSessionRepo = txManager.getRepository(WorkSession);
      const scanLogRepo = txManager.getRepository(ScanLog);

      let workSession: WorkSession;

      if (request.requestType === ManualAttendanceRequestType.EDIT_EXISTING) {
        // Update existing work session
        workSession = await workSessionRepo.findOne({ where: { id: request.existingWorkSessionId } });
        if (!workSession) throw new NotFoundException('Original work session not found');

        if (request.requestedCheckIn) workSession.checkInTime = request.requestedCheckIn;
        if (request.requestedCheckOut) workSession.checkOutTime = request.requestedCheckOut;
        workSession.source = 'MANUAL';

        // Recalculate total work minutes
        if (workSession.checkInTime && workSession.checkOutTime) {
          const diffMs = workSession.checkOutTime.getTime() - workSession.checkInTime.getTime();
          workSession.totalWorkMinutes = Math.round(diffMs / 60000) - workSession.totalBreakMinutes;
          workSession.isActive = false;
        }

        await workSessionRepo.save(workSession);
      } else if (request.requestType === ManualAttendanceRequestType.CHECK_OUT_ONLY) {
        // Add check-out to existing open session
        workSession = await workSessionRepo.findOne({ where: { id: request.existingWorkSessionId } });
        if (!workSession) throw new NotFoundException('Original work session not found');

        workSession.checkOutTime = request.requestedCheckOut;
        workSession.checkOutMethod = 'manual';
        workSession.source = 'MANUAL';

        if (workSession.checkInTime && workSession.checkOutTime) {
          const diffMs = workSession.checkOutTime.getTime() - workSession.checkInTime.getTime();
          workSession.totalWorkMinutes = Math.round(diffMs / 60000) - workSession.totalBreakMinutes;
          workSession.isActive = false;
          workSession.isOnBreak = false;
        }

        await workSessionRepo.save(workSession);

        // Create a scan log for check-out
        const checkOutLog = scanLogRepo.create({
          jobId: request.jobId,
          workerId: request.workerId,
          workCenterId: request.workCenterId,
          scanType: 'check-out',
          scanTime: request.requestedCheckOut,
          signingMethod: 'manual',
          source: 'MANUAL',
          notes: `Manual attendance approved. Reason: ${request.reason || 'N/A'}`,
        });
        await scanLogRepo.save(checkOutLog);
      } else {
        // FULL_DAY or CHECK_IN_ONLY: create new work session
        workSession = workSessionRepo.create({
          jobId: request.jobId,
          workerId: request.workerId,
          workCenterId: request.workCenterId,
          checkInTime: request.requestedCheckIn,
          checkOutTime: request.requestedCheckOut || undefined,
          checkInMethod: 'manual',
          checkOutMethod: request.requestedCheckOut ? 'manual' : undefined,
          source: 'MANUAL',
          isActive: !request.requestedCheckOut, // Active if no checkout provided
          isOnBreak: false,
          totalBreakMinutes: 0,
          totalWorkMinutes: 0,
          notes: `Manual attendance approved. Reason: ${request.reason || 'N/A'}`,
        });

        // Calculate total work minutes if both times provided
        if (request.requestedCheckIn && request.requestedCheckOut) {
          const diffMs = request.requestedCheckOut.getTime() - request.requestedCheckIn.getTime();
          workSession.totalWorkMinutes = Math.round(diffMs / 60000);
          workSession.isActive = false;
        }

        workSession = await workSessionRepo.save(workSession);

        // Create scan logs
        if (request.requestedCheckIn) {
          const checkInLog = scanLogRepo.create({
            jobId: request.jobId,
            workerId: request.workerId,
            workCenterId: request.workCenterId,
            scanType: 'check-in',
            scanTime: request.requestedCheckIn,
            signingMethod: 'manual',
            source: 'MANUAL',
            notes: `Manual attendance approved. Reason: ${request.reason || 'N/A'}`,
          });
          await scanLogRepo.save(checkInLog);
        }

        if (request.requestedCheckOut) {
          const checkOutLog = scanLogRepo.create({
            jobId: request.jobId,
            workerId: request.workerId,
            workCenterId: request.workCenterId,
            scanType: 'check-out',
            scanTime: request.requestedCheckOut,
            signingMethod: 'manual',
            source: 'MANUAL',
            notes: `Manual attendance approved. Reason: ${request.reason || 'N/A'}`,
          });
          await scanLogRepo.save(checkOutLog);
        }
      }

      // Update the request
      request.status = ManualAttendanceRequestStatus.APPROVED;
      request.reviewedByUserId = reviewerUserId;
      request.reviewedByRole = reviewerRole;
      request.reviewedAt = new Date();
      request.reviewerNotes = reviewerNotes;
      request.resultWorkSessionId = workSession.id;
      await requestRepo.save(request);
    });
  }

  // ─── Cancel Request ───────────────────────────────────────────────

  async cancelRequest(requestPublicId: string, userId: number): Promise<ManualAttendanceRequest> {
    const request = await this.requestRepo.findOne({
      where: { publicId: requestPublicId },
    });
    if (!request) throw new NotFoundException('Request not found');

    if (request.status !== ManualAttendanceRequestStatus.PENDING) {
      throw new BadRequestException('Only pending requests can be cancelled');
    }

    if (request.requestedByUserId !== userId) {
      throw new ForbiddenException('Only the requester can cancel their own request');
    }

    request.status = ManualAttendanceRequestStatus.CANCELLED;
    return this.requestRepo.save(request);
  }

  // ─── Helper: attach the worker's human-readable name to each request ─
  // The Worker entity has NO `name` column. Names are stored on the linked
  // User via the `workers_users` join table. This helper looks those names
  // up and attaches them as a top-level `name` field on `request.worker`
  // (matching the pattern used by WorkersService.findOne / findAll).
  private async enrichWorkerUsers(
    requests: ManualAttendanceRequest[],
  ): Promise<ManualAttendanceRequest[]> {
    if (!requests.length) return requests;

    const workerIds = requests
      .filter((r) => r.worker)
      .map((r) => r.worker.id);

    const uniqueIds = [...new Set(workerIds)];
    if (!uniqueIds.length) return requests;

    // Query by workerId column directly — simpler than walking the relation
    const workerUsers = await this.workerUserRepo.find({
      where: { workerId: In(uniqueIds) },
      relations: ['user'],
    });

    const byWorkerId = new Map<
      number,
      { name?: string; firstName?: string; lastName?: string; email?: string }
    >();
    for (const wu of workerUsers) {
      if (wu.workerId && wu.user) {
        byWorkerId.set(wu.workerId, {
          name: wu.user.name,
          firstName: wu.user.firstName,
          lastName: wu.user.lastName,
          email: (wu.user as any).email,
        });
      }
    }

    for (const r of requests) {
      if (!r.worker) continue;
      const u = byWorkerId.get(r.worker.id);
      if (!u) continue;

      // Top-level `name` — what the frontend (and the workers listing) reads
      const display =
        u.name ||
        [u.firstName, u.lastName].filter(Boolean).join(' ').trim() ||
        undefined;
      if (display && !(r.worker as any).name) {
        (r.worker as any).name = display;
      }

      // Nested `user` — defensive, for callers that read w.user?.name
      if (!(r.worker as any).user?.name) {
        (r.worker as any).user = {
          name: u.name,
          firstName: u.firstName,
          lastName: u.lastName,
          email: u.email,
        };
      }
    }

    return requests;
  }

  // ─── Query Requests ───────────────────────────────────────────────

  async getRequests(
    userId: number,
    query: QueryManualAttendanceRequestsDto,
  ): Promise<ManualAttendanceRequest[]> {
    const userRole = await this.getUserRoleString(userId);

    const qb = this.requestRepo.createQueryBuilder('r')
      .leftJoinAndSelect('r.job', 'job')
      .leftJoinAndSelect('job.client', 'client')
      .leftJoin('job.employer', 'employer')
      .leftJoinAndSelect('r.worker', 'worker')
      .leftJoinAndSelect('worker.user', 'workerUser')
      .leftJoinAndSelect('r.workCenter', 'workCenter')
      .leftJoinAndSelect('r.requestedByUser', 'requestedByUser')
      .leftJoinAndSelect('r.reviewedByUser', 'reviewedByUser')
      .orderBy('r.createdAt', 'DESC');

    // Scope by role
    if (userRole === 'EMPLOYER') {
      const employerId = await this.getEmployerIdForUser(userId);
      qb.andWhere('employer.id = :employerId', { employerId });
    } else if (userRole === 'CLIENT') {
      const clientId = await this.getClientIdForUser(userId);
      qb.andWhere('client.id = :clientId', { clientId });
    } else if (userRole === 'WORKER') {
      const workerId = await this.getWorkerIdForUser(userId);
      qb.andWhere('r.worker_id = :workerId', { workerId });
    }

    // Apply filters
    if (query.status) {
      qb.andWhere('r.status = :status', { status: query.status });
    }
    if (query.jobId) {
      const jobId = await this.resolveJobPublicId(query.jobId);
      qb.andWhere('r.job_id = :jobId', { jobId });
    }
    if (query.workerId) {
      const workerId = await this.resolveWorkerPublicId(query.workerId);
      qb.andWhere('r.worker_id = :workerId', { workerId });
    }
    if (query.startDate) {
      qb.andWhere('r.requested_date >= :startDate', { startDate: query.startDate });
    }
    if (query.endDate) {
      qb.andWhere('r.requested_date <= :endDate', { endDate: query.endDate });
    }

    const results = await qb.getMany();
    return this.enrichWorkerUsers(results);
  }

  async getMyRequests(userId: number): Promise<ManualAttendanceRequest[]> {
    const workerId = await this.getWorkerIdForUser(userId);
    if (!workerId) throw new ForbiddenException('Not a worker');

    const results = await this.requestRepo.find({
      where: { workerId },
      relations: ['job', 'job.client', 'worker', 'worker.user', 'workCenter', 'requestedByUser', 'reviewedByUser'],
      order: { createdAt: 'DESC' },
    });
    return this.enrichWorkerUsers(results);
  }

  async getRequestByPublicId(publicId: string): Promise<ManualAttendanceRequest> {
    const request = await this.requestRepo.findOne({
      where: { publicId },
      relations: ['job', 'job.client', 'worker', 'worker.user', 'workCenter', 'resultWorkSession', 'requestedByUser', 'reviewedByUser'],
    });
    if (!request) throw new NotFoundException('Request not found');
    return request;
  }

  async getPendingCount(userId: number): Promise<number> {
    const userRole = await this.getUserRoleString(userId);

    const qb = this.requestRepo.createQueryBuilder('r')
      .leftJoin('r.job', 'job')
      .leftJoin('job.employer', 'employer')
      .leftJoin('job.client', 'client')
      .where('r.status = :status', { status: ManualAttendanceRequestStatus.PENDING });

    if (userRole === 'EMPLOYER') {
      const employerId = await this.getEmployerIdForUser(userId);
      qb.andWhere('employer.id = :employerId', { employerId });
    } else if (userRole === 'CLIENT') {
      const clientId = await this.getClientIdForUser(userId);
      qb.andWhere('client.id = :clientId', { clientId });
    }

    return qb.getCount();
  }

  // ─── Direct Edit by Employer/Client (no approval needed) ─────────

  async directCreateAttendance(
    dto: CreateManualAttendanceRequestDto,
    userId: number,
  ): Promise<{ request: ManualAttendanceRequest; workSession: WorkSession }> {
    const userRole = await this.getUserRoleString(userId);

    if (userRole !== 'EMPLOYER' && userRole !== 'CLIENT' && userRole !== 'ADMIN') {
      throw new ForbiddenException('Only employers, clients, or admins can directly create attendance entries');
    }

    // Create the request
    const request = await this.createRequest(dto, userId);

    // Auto-approve it
    const reviewDto: ReviewManualAttendanceRequestDto = {
      action: 'APPROVE',
      reviewerNotes: 'Direct entry by ' + userRole.toLowerCase(),
    };

    // For direct entries, we allow self-review since the employer IS the authority
    const updatedRequest = await this.directApprove(request.publicId, userId, userRole, reviewDto.reviewerNotes);
    const workSession = await this.workSessionRepo.findOne({
      where: { id: updatedRequest.resultWorkSessionId },
    });

    return { request: updatedRequest, workSession };
  }

  private async directApprove(
    requestPublicId: string,
    userId: number,
    userRole: string,
    reviewerNotes?: string,
  ): Promise<ManualAttendanceRequest> {
    const request = await this.requestRepo.findOne({
      where: { publicId: requestPublicId },
      relations: ['job', 'job.employer', 'job.client', 'worker'],
    });
    if (!request) throw new NotFoundException('Request not found');

    await this.approveRequest(request, userId, userRole, reviewerNotes);

    return this.requestRepo.findOne({
      where: { id: request.id },
      relations: ['job', 'job.client', 'worker', 'worker.user', 'workCenter', 'resultWorkSession', 'requestedByUser', 'reviewedByUser'],
    });
  }

  // ─── Notifications ────────────────────────────────────────────────

  private async emitRequestNotification(
    request: ManualAttendanceRequest,
    job: Job,
    type: string,
  ): Promise<void> {
    try {
      if (!job?.employer || !job?.client) {
        // Reload job with relations if needed
        const fullJob = await this.jobRepo.findOne({
          where: { id: request.jobId },
          relations: ['employer', 'client'],
        });
        if (fullJob) {
          job = fullJob;
        }
      }

      // Get employer user ID
      const employerUser = await this.employerUserRepo.findOne({
        where: { employer: { id: job.employer?.id } },
        relations: ['user'],
      });

      // Get client user ID
      let clientUserId = 0;
      if (job.client) {
        const clientUser = await this.clientUserRepo.findOne({
          where: { clientId: job.client.id },
          relations: ['user'],
        });
        clientUserId = clientUser?.userId ?? 0;
      }

      // Get worker user ID for worker notifications
      let workerUserId = 0;
      const workerUser = await this.workerUserRepo.findOne({
        where: { workerId: request.workerId },
        relations: ['user'],
      });
      workerUserId = workerUser?.userId ?? 0;

      const workerName = request.worker?.user?.name
        || `Worker #${request.workerId}`;

      let message: string;
      switch (type) {
        case 'MANUAL_ATTENDANCE_REQUESTED':
          message = `Manual attendance requested by ${request.requestedByRole.toLowerCase()} for ${job.jobName} on ${request.requestedDate}`;
          break;
        case 'MANUAL_ATTENDANCE_APPROVED':
          message = `Manual attendance approved for ${job.jobName} on ${request.requestedDate}`;
          break;
        case 'MANUAL_ATTENDANCE_REJECTED':
          message = `Manual attendance rejected for ${job.jobName} on ${request.requestedDate}${request.reviewerNotes ? '. Reason: ' + request.reviewerNotes : ''}`;
          break;
        default:
          message = `Manual attendance update for ${job.jobName}`;
      }

      await this.alertsService.createAndEmitAlert({
        type: type as any,
        jobId: request.jobId,
        jobPublicId: job.publicId,
        workerId: request.workerId,
        employerUserId: employerUser?.user?.id ?? 0,
        clientUserId,
        message,
        meta: {
          requestPublicId: request.publicId,
          requestType: request.requestType,
          requestStatus: request.status,
          workerUserId,
        },
      });

      // Also emit to worker if they should be notified
      if (workerUserId && (type === 'MANUAL_ATTENDANCE_APPROVED' || type === 'MANUAL_ATTENDANCE_REJECTED')) {
        this.alertsService['gateway']?.emitAlertToWorker?.(workerUserId, {
          type,
          jobId: request.jobId,
          jobPublicId: job.publicId,
          workerId: request.workerId,
          message,
          createdAt: new Date().toISOString(),
        });
      }
    } catch (err) {
      // Don't fail the request if notification fails
      console.error('[ManualAttendance] Notification error:', err?.message || err);
    }
  }
}
