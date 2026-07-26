import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { BaseResponse } from '../../common/interfaces/base-response.interface';
import { CloudinaryService } from '../cloudinary/cloudinary.service';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Worker } from './entities/worker.entity';
import { WorkerUser } from './entities/worker-user.entity';
import { CreateWorkerDto } from './dto/create-worker.dto';
import { UpdateWorkerDto } from './dto/update-worker.dto';
import { AssignWorkerUserDto } from './dto/assign-worker-user.dto';
import { User } from '../../modules/users/entities/user.entity';
import { Role } from '../users/entities/role.entity';
import { Employer } from '../../modules/employers/entities/employer.entity';
import { EmployerWorker } from '../../modules/employers/entities/employer-worker.entity';
import { EmployerUser } from '../../modules/employers/entities/employer-user.entity';
import { madridTodayKey } from '../../common/helpers/business-time';
import { revokeUserSessions } from '../../common/helpers/account-status';
import { Client } from '../clients/entities/client.entity';
import { Job } from '../job/entities/job.entity';
import { WorkerDocument } from './entities/worker-document.entity';
import { SalaryReceipt } from './entities/salary-receipt.entity';
import { In } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import { EmailService } from '../../common/services/email.service';
import { renderLineDocPdf, DocLine } from '../../common/helpers/line-doc-pdf';

@Injectable()
export class WorkersService {
  constructor(
    @InjectRepository(Worker)
    private workerRepo: Repository<Worker>,
    @InjectRepository(WorkerUser)
    private workerUserRepo: Repository<WorkerUser>,
    @InjectRepository(User)
    private userRepo: Repository<User>,
    @InjectRepository(Role)
    private roleRepo: Repository<Role>,
    @InjectRepository(Employer)
    private employerRepo: Repository<Employer>,
    @InjectRepository(EmployerWorker)
    private employerWorkerRepo: Repository<EmployerWorker>,
    private dataSource: DataSource,
    private readonly emailService: EmailService,
    private readonly cloudinaryService: CloudinaryService,
    @InjectRepository(Client)
    private clientRepo: Repository<Client>,
    @InjectRepository(Job)
    private jobRepo: Repository<Job>,
    @InjectRepository(WorkerDocument)
    private workerDocumentRepo: Repository<WorkerDocument>,
    @InjectRepository(SalaryReceipt)
    private salaryReceiptRepo: Repository<SalaryReceipt>,
    @InjectRepository(EmployerUser)
    private employerUserRepo: Repository<EmployerUser>,
  ) {}

  private readonly attachmentMimeTypes = [
    'application/pdf',
    'image/png',
    'image/jpeg',
    'image/jpg',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  ];

  private mapWorkerDocument(f: WorkerDocument) {
    return {
      id: f.publicId,
      fileName: f.fileName,
      url: f.url,
      mimeType: f.mimeType,
      sizeBytes: f.sizeBytes != null ? Number(f.sizeBytes) : null,
      description: f.description,
      category: f.category || 'otros',
      createdAt: f.createdAt,
    };
  }

  async listWorkerDocuments(workerId: number) {
    const files = await this.workerDocumentRepo.find({
      where: { workerId },
      order: { createdAt: 'DESC' },
    });
    return files.map((f) => this.mapWorkerDocument(f));
  }

  async uploadWorkerDocument(
    workerId: number,
    file: Express.Multer.File,
    description: string | undefined,
    userId: number | undefined,
    category?: string,
  ) {
    const cat = category === 'justificante' ? 'justificante' : 'otros';
    if (!file) throw new BadRequestException('No file uploaded');
    if (!this.attachmentMimeTypes.includes(file.mimetype)) {
      throw new BadRequestException('Unsupported file type (PDF, image or Office document only)');
    }
    if (file.size > 15 * 1024 * 1024) {
      throw new BadRequestException('File must be 15 MB or smaller');
    }
    const worker = await this.workerRepo.findOne({ where: { id: workerId } });
    if (!worker) throw new NotFoundException('Worker not found');

    const uploaded = await this.cloudinaryService.uploadAttachment(
      file.buffer,
      'controljobs/worker-documents',
      'auto',
    );
    const rec = this.workerDocumentRepo.create({
      workerId,
      fileName: file.originalname,
      url: uploaded.secureUrl,
      storagePublicId: uploaded.publicId,
      resourceType: uploaded.resourceType || 'raw',
      mimeType: file.mimetype,
      sizeBytes: file.size,
      description: description || null,
      category: cat,
      uploadedByUserId: userId || null,
    });
    const saved = await this.workerDocumentRepo.save(rec);
    return this.mapWorkerDocument(saved);
  }

  async deleteWorkerDocument(workerId: number, filePublicId: string): Promise<void> {
    const f = await this.workerDocumentRepo.findOne({
      where: { publicId: filePublicId, workerId },
    });
    if (!f) throw new NotFoundException('Document not found');
    await this.workerDocumentRepo.delete(f.id);
    try {
      await this.cloudinaryService.deleteAsset(f.storagePublicId, f.resourceType);
    } catch {
      /* asset cleanup is best-effort */
    }
  }

  private num(v: string | number | null | undefined): number {
    if (v == null) return 0;
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  }

  async getWorkerSalaryConfig(workerId: number) {
    const worker = await this.workerRepo.findOne({ where: { id: workerId } });
    if (!worker) throw new NotFoundException('Worker not found');
    return {
      fixedAmount: worker.salaryFixedAmount != null ? Number(worker.salaryFixedAmount) : null,
      hoursLabel: worker.salaryHoursLabel || 'Horas de trabajo',
      hourRate: worker.salaryHourRate != null ? Number(worker.salaryHourRate) : null,
    };
  }

  async updateWorkerSalaryConfig(
    workerId: number,
    dto: { fixedAmount?: number | null; hoursLabel?: string; hourRate?: number | null },
  ) {
    const worker = await this.workerRepo.findOne({ where: { id: workerId } });
    if (!worker) throw new NotFoundException('Worker not found');
    if (dto.fixedAmount !== undefined) worker.salaryFixedAmount = dto.fixedAmount == null ? null : String(dto.fixedAmount);
    if (dto.hoursLabel !== undefined) worker.salaryHoursLabel = dto.hoursLabel || 'Horas de trabajo';
    if (dto.hourRate !== undefined) worker.salaryHourRate = dto.hourRate == null ? null : String(dto.hourRate);
    await this.workerRepo.save(worker);
    return this.getWorkerSalaryConfig(workerId);
  }

  private async workedHoursForWorker(workerId: number, periodStart: string, periodEnd: string): Promise<number> {
    const row = await this.dataSource.query(
      `SELECT COALESCE(SUM(total_work_minutes), 0) AS minutes
         FROM work_sessions
        WHERE worker_id = $1
          AND check_in_time >= $2
          AND check_in_time < ($3::date + INTERVAL '1 day')
          -- Auto-closed sessions stay out until a human settles them.
          AND (review_status IS NULL OR review_status = 'CONFIRMED')`,
      [workerId, periodStart, periodEnd],
    );
    const minutes = Number(row?.[0]?.minutes || 0);
    return Math.round((minutes / 60) * 100) / 100;
  }

  private async employerIdForWorker(workerId: number): Promise<number | null> {
    const link = await this.employerWorkerRepo.findOne({
      where: { worker: { id: workerId } },
      relations: ['employer'],
    });
    return link?.employer?.id || null;
  }

  private mapSalaryReceipt(r: SalaryReceipt) {
    return {
      id: r.publicId,
      receiptNumber: r.receiptNumber,
      issueDate: r.issueDate,
      periodStart: r.periodStart,
      periodEnd: r.periodEnd,
      fixedLabel: r.fixedLabel,
      fixedAmount: r.fixedAmount != null ? Number(r.fixedAmount) : null,
      hoursLabel: r.hoursLabel,
      hoursQty: this.num(r.hoursQty),
      hourRate: this.num(r.hourRate),
      hoursAmount: this.num(r.hoursAmount),
      total: this.num(r.total),
      status: r.status,
      notes: r.notes,
      createdAt: r.createdAt,
    };
  }

  async getWorkerSalaryPreview(workerId: number, periodStart: string, periodEnd: string) {
    if (!periodStart || !periodEnd) throw new BadRequestException('periodStart and periodEnd are required');
    const cfg = await this.getWorkerSalaryConfig(workerId);
    const link = await this.employerWorkerRepo.findOne({ where: { worker: { id: workerId } }, relations: ['employer'] });
    const def: any = link?.employer || {};
    const dn = (v: any) => (v != null ? Number(v) : null);
    const hoursQty = await this.workedHoursForWorker(workerId, periodStart, periodEnd);
    const hourRate = cfg.hourRate ?? dn(def.defSalaryHourRate) ?? 0;
    const hoursAmount = Math.round(hoursQty * hourRate * 100) / 100;
    const fixedAmount = cfg.fixedAmount ?? dn(def.defSalaryFixedAmount);
    const total = Math.round(((fixedAmount ?? 0) + hoursAmount) * 100) / 100;
    return {
      periodStart,
      periodEnd,
      fixedLabel: 'Gastos fijos',
      fixedAmount,
      hoursLabel: cfg.hoursLabel,
      hoursQty,
      hourRate,
      hoursAmount,
      total,
    };
  }

  async listSalaryReceipts(workerId: number) {
    const receipts = await this.salaryReceiptRepo.find({
      where: { workerId },
      order: { issueDate: 'DESC', createdAt: 'DESC' },
    });
    return receipts.map((r) => this.mapSalaryReceipt(r));
  }

  private async nextReceiptNumber(employerId: number): Promise<string> {
    const year = Number(madridTodayKey().slice(0, 4));
    const count = await this.salaryReceiptRepo
      .createQueryBuilder('r')
      .where('r.employer_id = :employerId', { employerId })
      .andWhere(`EXTRACT(YEAR FROM r.issue_date) = :year`, { year })
      .getCount();
    return `RS-${year}-${String(count + 1).padStart(4, '0')}`;
  }

  async createSalaryReceipt(
    workerId: number,
    body: {
      receiptNumber?: string;
      issueDate?: string;
      periodStart?: string;
      periodEnd?: string;
      fixedAmount?: number | null;
      hoursLabel?: string;
      hoursQty?: number;
      hourRate?: number;
      status?: string;
      notes?: string;
    },
    userId: number | undefined,
  ) {
    const worker = await this.workerRepo.findOne({ where: { id: workerId } });
    if (!worker) throw new NotFoundException('Worker not found');
    if (!body.periodStart || !body.periodEnd) throw new BadRequestException('A pay period is required');

    const employerId = await this.employerIdForWorker(workerId);
    if (!employerId) throw new BadRequestException('This worker is not linked to an employer');

    const fixedAmount = body.fixedAmount != null ? Number(body.fixedAmount) : null;
    const hoursQty = this.num(body.hoursQty);
    const hourRate = this.num(body.hourRate);
    const hoursAmount = Math.round(hoursQty * hourRate * 100) / 100;
    const total = Math.round(((fixedAmount ?? 0) + hoursAmount) * 100) / 100;

    const rec = this.salaryReceiptRepo.create({
      workerId,
      employerId,
      receiptNumber: body.receiptNumber?.trim() || (await this.nextReceiptNumber(employerId)),
      issueDate: body.issueDate || madridTodayKey(),
      periodStart: body.periodStart,
      periodEnd: body.periodEnd,
      fixedLabel: 'Gastos fijos',
      fixedAmount: fixedAmount == null ? null : String(fixedAmount),
      hoursLabel: body.hoursLabel || worker.salaryHoursLabel || 'Horas de trabajo',
      hoursQty: String(hoursQty),
      hourRate: String(hourRate),
      hoursAmount: String(hoursAmount),
      total: String(total),
      status: body.status || 'pending',
      notes: body.notes || null,
      uploadedByUserId: userId || null,
    });
    const saved = await this.salaryReceiptRepo.save(rec);
    return this.mapSalaryReceipt(saved);
  }

  async deleteSalaryReceipt(workerId: number, receiptPublicId: string): Promise<void> {
    const r = await this.salaryReceiptRepo.findOne({
      where: { publicId: receiptPublicId, workerId },
    });
    if (!r) throw new NotFoundException('Salary receipt not found');
    await this.salaryReceiptRepo.delete(r.id);
  }

  async listAllSalaryReceiptsForEmployer(userId: number) {
    const link = await this.employerUserRepo.findOne({ where: { user: { id: userId } }, relations: ['employer'] });
    const employerId = link?.employer?.id;
    if (!employerId) throw new NotFoundException('Employer not found for this user');
    const receipts = await this.salaryReceiptRepo.find({
      where: { employerId },
      relations: ['worker', 'worker.user'],
      order: { issueDate: 'DESC', createdAt: 'DESC' },
    });
    const names = await this.resolveWorkerNames(receipts.map((r) => r.workerId));
    return receipts.map((r) => ({ ...this.mapSalaryReceipt(r), workerName: names.get(r.workerId) || r.worker?.user?.name || r.worker?.code || null }));
  }

  async listMySalaries(userId: number) {
    const workerId = await this.findWorkerIdByUserId(userId);
    return this.listSalaryReceipts(workerId);
  }

  async listMyDocuments(userId: number) {
    const workerId = await this.findWorkerIdByUserId(userId);
    return this.listWorkerDocuments(workerId);
  }

  async renderSalaryReceiptPdf(workerId: number, receiptPublicId: string): Promise<{ buffer: Buffer; fileName: string }> {
    const r = await this.salaryReceiptRepo.findOne({ where: { publicId: receiptPublicId, workerId } });
    if (!r) throw new NotFoundException('Salary receipt not found');
    const worker: any = await this.workerRepo.findOne({ where: { id: workerId }, relations: ['user'] });
    const employer: any = await this.employerRepo.findOne({ where: { id: r.employerId } });
    const workerName = (await this.resolveWorkerNames([workerId])).get(workerId);

    const lines: DocLine[] = [];
    if (r.fixedAmount != null) {
      lines.push({ description: r.fixedLabel, quantity: 1, unitPrice: Number(r.fixedAmount), amount: Number(r.fixedAmount) });
    }
    lines.push({ description: r.hoursLabel, quantity: Number(r.hoursQty), unitPrice: Number(r.hourRate), amount: Number(r.hoursAmount) });

    const buffer = await renderLineDocPdf({
      docType: 'RECIBO DE SALARIO',
      number: r.receiptNumber,
      issueDate: r.issueDate,
      periodStart: r.periodStart,
      periodEnd: r.periodEnd,
      issuer: {
        name: employer?.name || 'Empleador',
        taxId: employer?.taxId || null,
        lines: [employer?.address, [employer?.postalCode, employer?.city].filter(Boolean).join(' '), employer?.province],
      },
      recipient: {
        name: workerName || worker?.user?.name || worker?.code || 'Trabajador',
        taxId: worker?.nif || null,
        lines: [worker?.address, [worker?.postalCode, worker?.city].filter(Boolean).join(' '), worker?.province],
      },
      recipientHeading: 'Trabajador',
      lines,
      total: Number(r.total),
      showVat: false,
    });
    return { buffer, fileName: `${r.receiptNumber}.pdf` };
  }

  // Workers connected to a client *via the jobs they are assigned to*. This
  // is read-only / informational — the same worker may legitimately appear
  // under several clients if their jobs span multiple clients. Deduped by
  // worker.id, with full row fields for the Workers tab table.
  async getWorkersByClientPublicId(publicId: string) {
    const client = await this.clientRepo.findOne({ where: { publicId } });
    if (!client) {
      return {
        message: 'Client not found',
        data: [],
        isSuccess: false,
        statusCode: 404,
        developerError: `Client with publicId ${publicId} not found`,
      };
    }

    const jobs = await this.jobRepo.find({
      where: { client: { id: client.id } },
      relations: ['workers'],
    });

    const workerIds = [
      ...new Set(jobs.flatMap((j) => (j.workers || []).map((w) => w.id))),
    ];
    if (workerIds.length === 0) {
      return {
        message: 'No workers connected to this client',
        data: [],
        isSuccess: true,
        statusCode: 200,
      };
    }

    const workers = await this.workerRepo.find({ where: { id: In(workerIds) } });

    // The Worker→User link in this codebase is the `workers_users` junction
    // table — Worker.user_id is null on production rows. Pull the linked
    // user via the junction so we can compose a display name.
    const links = await this.workerUserRepo.find({
      where: { workerId: In(workerIds) },
      relations: ['user'],
    });
    const workerIdToUser = new Map<number, User>();
    for (const link of links) {
      if (link.workerId && link.user) workerIdToUser.set(link.workerId, link.user);
    }

    const composeName = (u?: User | null): string | null => {
      if (!u) return null;
      const trimmed = (u.name || '').trim();
      if (trimmed) return trimmed;
      const fn = (u.firstName || '').trim();
      const ln = (u.lastName || '').trim();
      const joined = [fn, ln].filter(Boolean).join(' ');
      if (joined) return joined;
      return u.email || null;
    };

    const data = workers.map((w) => ({
      id: w.id,
      publicId: w.publicId,
      code: w.code,
      name: composeName(workerIdToUser.get(w.id)),
      occupation: w.occupation || null,
      mobile: w.mobile || null,
      city: w.city || null,
      postalCode: w.postalCode || null,
      logoUrl: w.logoUrl || null,
    }));

    return {
      message: 'Workers connected via jobs',
      data,
      isSuccess: true,
      statusCode: 200,
    };
  }

  async resolvePublicId(publicId: string): Promise<number> {
    const worker = await this.workerRepo.findOne({ where: { publicId } });
    if (!worker) throw new NotFoundException('Worker not found');
    return worker.id;
  }

  // Worker names live on the workers_users junction, NOT worker.user_id (that
  // direct FK is unpopulated), so worker.user?.name is always null and callers
  // fall back to the bare code. Resolve real names via the junction.
  async resolveWorkerNames(workerIds: number[]): Promise<Map<number, string>> {
    const names = new Map<number, string>();
    const ids = [...new Set(workerIds.filter((id) => id != null))];
    if (!ids.length) return names;
    const links = await this.workerUserRepo.find({
      where: ids.map((id) => ({ workerId: id })),
      relations: ['user'],
    });
    for (const l of links) {
      if (l.workerId && l.user?.name) names.set(l.workerId, l.user.name);
    }
    return names;
  }

  async findWorkerIdByUserId(userId: number): Promise<number> {
    const link = await this.workerUserRepo.findOne({ where: { userId } });
    if (link?.workerId) return link.workerId;
    // Fallback: legacy workers may be linked directly via Worker.user.id.
    const direct = await this.workerRepo.findOne({
      where: { user: { id: userId } },
      relations: ['user'],
    });
    if (direct?.id) return direct.id;
    throw new NotFoundException('No worker is linked to the current user');
  }

  async setLogo(
    id: number,
    file: Express.Multer.File,
  ): Promise<BaseResponse<{ logoUrl: string; logoPublicId: string }>> {
    if (!file) throw new BadRequestException('No file uploaded');
    if (!['image/png', 'image/jpeg', 'image/jpg'].includes(file.mimetype)) {
      throw new BadRequestException('Logo must be PNG or JPEG');
    }
    if (file.size > 2 * 1024 * 1024) {
      throw new BadRequestException('Logo must be 2 MB or smaller');
    }

    const worker = await this.workerRepo.findOne({ where: { id } });
    if (!worker) throw new NotFoundException(`Worker ${id} not found`);

    const oldPublicId = worker.logoPublicId;
    const uploaded = await this.cloudinaryService.uploadImage(
      file.buffer,
      'controljobs/worker-photos',
    );
    worker.logoPublicId = uploaded.publicId;
    worker.logoUrl = uploaded.secureUrl;
    await this.workerRepo.save(worker);

    if (oldPublicId && oldPublicId !== uploaded.publicId) {
      await this.cloudinaryService.deleteImage(oldPublicId);
    }

    return {
      message: 'Logo updated',
      data: { logoUrl: uploaded.secureUrl, logoPublicId: uploaded.publicId },
      isSuccess: true,
      statusCode: 200,
    };
  }

  async clearLogo(id: number): Promise<BaseResponse<null>> {
    const worker = await this.workerRepo.findOne({ where: { id } });
    if (!worker) throw new NotFoundException(`Worker ${id} not found`);

    const oldPublicId = worker.logoPublicId;
    worker.logoPublicId = null;
    worker.logoUrl = null;
    await this.workerRepo.save(worker);
    if (oldPublicId) await this.cloudinaryService.deleteImage(oldPublicId);

    return {
      message: 'Logo removed',
      data: null,
      isSuccess: true,
      statusCode: 200,
    };
  }

  findAll() {
    return this.workerRepo.find();
  }

  async findOne(id: number) {
    const worker = await this.workerRepo.findOne({ where: { id } });
    if (!worker) throw new NotFoundException('Worker not found');

    // Fetch linked user name and email
    const workerUser = await this.workerUserRepo.findOne({
      where: { workerId: id },
      relations: ['user'],
    });
    const name = workerUser?.user?.name || '';
    const email = workerUser?.user?.email || '';

    return { ...worker, name, email };
  }

  async findByPublicId(publicId: string) {
    const worker = await this.workerRepo.findOne({ where: { publicId } });
    if (!worker) throw new NotFoundException('Worker not found');
    const workerUser = await this.workerUserRepo.findOne({
      where: { workerId: worker.id },
      relations: ['user'],
    });
    const name = workerUser?.user?.name || '';
    const email = workerUser?.user?.email || '';
    return { ...worker, name, email };
  }

  async update(id: number, dto: UpdateWorkerDto) {
    const worker = await this.workerRepo.findOne({ where: { id } });
    if (!worker) throw new NotFoundException('Worker not found');

    // Extract user-level fields before assigning to worker entity. `active` is
    // owned by setActive(), which also syncs the login and revokes tokens — a
    // plain update writing it would deactivate the worker on paper only.
    const { email, accessEmail, name, active: _active, ...workerFields } =
      dto as any;
    Object.assign(worker, workerFields);
    await this.workerRepo.save(worker);

    // Update linked user's email/name if provided
    if (email !== undefined || name !== undefined) {
      const workerUser = await this.workerUserRepo.findOne({
        where: { workerId: id },
        relations: ['user'],
      });
      if (workerUser?.user) {
        if (email !== undefined) workerUser.user.email = email;
        if (name !== undefined) workerUser.user.name = name;
        await this.userRepo.save(workerUser.user);
      }
    }

    return this.findOne(id);
  }

  async updateByPublicId(publicId: string, dto: UpdateWorkerDto) {
    const worker = await this.workerRepo.findOne({ where: { publicId } });
    if (!worker) throw new NotFoundException('Worker not found');

    // Extract user-level fields before assigning to worker entity. `active` is
    // owned by setActive(), which also syncs the login and revokes tokens — a
    // plain update writing it would deactivate the worker on paper only.
    const { email, accessEmail, name, active: _active, ...workerFields } =
      dto as any;
    Object.assign(worker, workerFields);
    await this.workerRepo.save(worker);

    // Update linked user's email/name if provided
    if (email !== undefined || name !== undefined) {
      const workerUser = await this.workerUserRepo.findOne({
        where: { workerId: worker.id },
        relations: ['user'],
      });
      if (workerUser?.user) {
        if (email !== undefined) workerUser.user.email = email;
        if (name !== undefined) workerUser.user.name = name;
        await this.userRepo.save(workerUser.user);
      }
    }

    return this.findByPublicId(publicId);
  }

  async setActive(id: number, active: boolean) {
    return this.dataSource.transaction(async (manager) => {
      const worker = await manager.findOne(Worker, { where: { id } });
      if (!worker) throw new NotFoundException('Worker not found');

      worker.active = active;
      await manager.save(worker);

      if (!active) {
        const links = await manager.find(WorkerUser, { where: { workerId: id } });
        await revokeUserSessions(
          manager,
          links.map((l) => l.userId),
        );
      }

      return worker;
    });
  }

  // An employer may only touch workers linked to their own company. Role alone
  // is not enough: without this, any employer could deactivate any worker whose
  // publicId they knew.
  private async assertEmployerOwnsWorker(requesterUserId: number, workerId: number) {
    const link = await this.employerUserRepo.findOne({
      where: { user: { id: requesterUserId } },
      relations: ['employer'],
    });
    if (!link?.employer) {
      throw new ForbiddenException('No employer is linked to the current user');
    }

    const owns = await this.employerWorkerRepo.findOne({
      where: { employer: { id: link.employer.id }, worker: { id: workerId } },
    });
    if (!owns) {
      throw new ForbiddenException('This worker does not belong to your company');
    }
  }

  async setActiveByPublicId(
    publicId: string,
    active: boolean,
    requesterUserId: number,
  ) {
    const worker = await this.workerRepo.findOne({ where: { publicId } });
    if (!worker) throw new NotFoundException('Worker not found');
    await this.assertEmployerOwnsWorker(requesterUserId, worker.id);
    return this.setActive(worker.id, active);
  }

  async assignUser(dto: AssignWorkerUserDto) {
    const workerId = await this.resolvePublicId(dto.workerId);
    const user = await this.userRepo.findOne({ where: { publicId: dto.userId } });
    if (!user) throw new NotFoundException(`User ${dto.userId} not found`);
    const relation = this.workerUserRepo.create({ workerId, userId: user.id });
    return this.workerUserRepo.save(relation);
  }

  async getUsersByWorker(workerId: number) {
    return this.workerUserRepo.find({
      where: { workerId },
      relations: ['user'],
    });
  }

  /**
   * Create a worker by employer
   * @param dto - Worker creation data
   * @param employerUser - The user performing the action (must be employer)
   */
  async createByEmployer(dto: CreateWorkerDto, employerUser: User) {
    // Only allow employer role
    const employerRole = await this.roleRepo.findOne({ where: { value: 3 } });
    if (!employerUser || employerUser.roleId !== employerRole.id) {
      throw new Error('Only employer can add workers');
    }
    return this.dataSource.transaction(async (manager) => {
      // 1. Create user for worker
      const existingUser = await manager.findOne(User, {
        where: { email: dto.email },
      });
      if (existingUser) throw new Error('Email ya utilizado');
      const workerRole = await manager.findOne(Role, { where: { value: 5 } }); // 5 = Worker
      if (!workerRole) throw new Error('Worker role not found');
      // Auto-generate password (or set default)
      const rawPassword = 'Worker' + Math.random().toString(36).slice(-8);
      const hashedPassword = await bcrypt.hash(rawPassword, 10);
      const user = manager.create(User, {
        name: dto.name,
        email: dto.email,
        password: hashedPassword,
        roleId: workerRole.id,
      });
      const savedUser = await manager.save(User, user);
      // 2. Find employer via EmployerUser
      const employerUserLink = await manager.findOne(EmployerUser, {
        where: { user: { id: employerUser.id } },
        relations: ['employer'],
      });
      if (!employerUserLink || !employerUserLink.employer) throw new Error('Employer not found for this user');
      const employerId = employerUserLink.employer.id;
      // 3. Create worker (only required fields)
      let genderEntity = null;
      if (dto.gender) {
        genderEntity = await manager.findOne('Gender', { where: { id: Number(dto.gender) } });
      }
      const worker = manager.create(Worker, {
        code: dto.code,
        landline: dto.landline,
        mobile: dto.mobile,
        nif: dto.nif,
        naf: dto.naf,
        occupation: dto.occupation,
        birthday: dto.birthday,
        gender: genderEntity,
        accessAccountStatus: dto.accessAccountStatus || 'postpone',
        active: true,
        address: dto.address,
        street: dto.street,
        streetNumber: dto.streetNumber,
        floorDoor: dto.floorDoor,
        postalCode: dto.postalCode,
        city: dto.city,
        province: dto.province,
        country: dto.country,
        latitude: dto.latitude,
        longitude: dto.longitude,
      });
      const savedWorker = await manager.save(Worker, worker);
      // 4. Link employer and worker
      const employerWorker = manager.create('EmployerWorker', {
        employer: { id: employerId } as any,
        worker: { id: savedWorker.id } as any,
        isActive: true,
      });
      await manager.save('EmployerWorker', employerWorker);
      // 5. Link user and worker
      const workerUser = manager.create(WorkerUser, {
        workerId: savedWorker.id,
        userId: savedUser.id,
      });
      await manager.save(WorkerUser, workerUser);

      // Send credentials email if accessAccountStatus is 'request'
      if ((dto as any).accessAccountStatus === 'request') {
        try {
          const emailTo = (dto as any).accessEmail || dto.email;
          await this.emailService.sendUserCredentials(
            emailTo,
            dto.name,
            rawPassword,
            'worker',
            dto.email,
          );
        } catch (emailError) {
          console.error('Failed to send worker credentials email:', emailError?.message || emailError);
        }
      }

      // Re-fetch to get DB-generated publicId (uuid_generate_v4)
      const fullWorker = await manager.findOne(Worker, { where: { id: savedWorker.id } });
      return { worker: fullWorker, user: savedUser };
    });
  }

  /**
   * Get all workers for a given employer user
   * @param employerUser - The user performing the action (must be employer)
   */
  async findAllByEmployer(employerUser: User) {
    // Find employerId for this user
    const employerUserLink = await this.dataSource.getRepository(EmployerUser).findOne({
      where: { user: { id: employerUser.id } },
      relations: ['employer'],
    });
    if (!employerUserLink || !employerUserLink.employer) throw new Error('Employer not found for this user');
    const employerId = employerUserLink.employer.id;
    // Find all EmployerWorker links for this employer
    const employerWorkers = await this.employerWorkerRepo.find({
      where: { employer: { id: employerId }, isActive: true },
      relations: ['worker'],
    });
    // For each worker, get the related user (for name)
    const workerIds = employerWorkers.map(ew => ew.worker.id);
    const workerUsers = await this.workerUserRepo.find({
      where: workerIds.length ? workerIds.map(id => ({ workerId: id })) : undefined,
      relations: ['user'],
    });
    // Map workerId to user name
    const workerIdToUserName = new Map<number, string>();
    workerUsers.forEach(wu => {
      if (wu.user) {
        workerIdToUserName.set(wu.workerId, wu.user.name);
      }
    });
    // Map to frontend expectations
    return employerWorkers.map(ew => {
      const w = ew.worker;
      // Combine landline and mobile for telephones
      let telephones = '';
      if (w.landline && w.mobile) {
        telephones = `${w.landline} | ${w.mobile}`;
      } else if (w.landline) {
        telephones = w.landline;
      } else if (w.mobile) {
        telephones = w.mobile;
      }
      // Asset: always 'yeah' or 'no'
      let asset = 'no';
      if (typeof w.asset === 'string') {
        asset = w.asset.toLowerCase() === 'yeah' ? 'yeah' : 'no';
      } else if (w.active) {
        asset = 'yeah';
      }
      return {
        id: w.id,
        publicId: w.publicId,
        name: workerIdToUserName.get(w.id) || '',
        occupation: w.occupation,
        landline: w.landline || '',
        mobile: w.mobile || '',
        telephones,
        address: (w as any).address || '',
        street: (w as any).street || '',
        streetNumber: (w as any).streetNumber || '',
        floorDoor: (w as any).floorDoor || '',
        postalCode: (w as any).postalCode || '',
        city: (w as any).city || '',
        province: (w as any).province || '',
        country: (w as any).country || '',
        latitude: (w as any).latitude || null,
        longitude: (w as any).longitude || null,
        asset,
      };
    });
  }

  // All workers across every employer, for the admin Accounts > Workers list.
  async findAllForAdmin() {
    const links = await this.employerWorkerRepo.find({
      where: { isActive: true },
      relations: ['worker', 'employer'],
    });

    const workerIds = links.map((l) => l.worker.id);
    const workerUsers = workerIds.length
      ? await this.workerUserRepo.find({
          where: workerIds.map((id) => ({ workerId: id })),
          relations: ['user'],
        })
      : [];

    const workerIdToUserName = new Map<number, string>();
    workerUsers.forEach((wu) => {
      if (wu.user) workerIdToUserName.set(wu.workerId, wu.user.name);
    });

    return links.map((l) => {
      const w = l.worker;
      return {
        id: w.id,
        publicId: w.publicId,
        name: workerIdToUserName.get(w.id) || '',
        city: w.city || '',
        province: w.province || '',
        occupation: w.occupation || '',
        employer: l.employer?.name || '',
        employerPublicId: l.employer?.publicId || '',
        active: w.active,
      };
    });
  }

  private async resolveEmployerIdForUser(employerUser: User): Promise<number> {
    const link = await this.dataSource.getRepository(EmployerUser).findOne({
      where: { user: { id: employerUser.id } },
      relations: ['employer'],
    });
    if (!link?.employer) throw new NotFoundException('Employer not found for this user');
    return link.employer.id;
  }

  /** Jobs the given worker is assigned to, scoped to the requesting employer. */
  async getWorkerJobs(publicId: string, employerUser: User) {
    const employerId = await this.resolveEmployerIdForUser(employerUser);
    const workerId = await this.resolvePublicId(publicId);
    const jobs = await this.dataSource
      .getRepository(Job)
      .createQueryBuilder('job')
      .innerJoin('job.workers', 'w', 'w.id = :workerId', { workerId })
      .innerJoin('job.employer', 'emp', 'emp.id = :employerId', { employerId })
      .leftJoinAndSelect('job.client', 'client')
      .leftJoinAndSelect('job.workCenters', 'wc')
      .orderBy('job.jobName', 'ASC')
      .getMany();
    return jobs.map((j) => ({
      id: j.id,
      publicId: j.publicId,
      holder: j.client?.name || '',
      denomination: j.jobName,
      // Joined string drives sort/search/export; the array feeds the compact
      // "first + N" popover on the frontend.
      workCenter: (j.workCenters || []).map((wc) => wc.name).join(', '),
      workCenters: (j.workCenters || []).map((wc) => wc.name).filter(Boolean),
    }));
  }

  /** Distinct clients the given worker serves through their jobs (employer-scoped). */
  async getWorkerClients(publicId: string, employerUser: User) {
    const employerId = await this.resolveEmployerIdForUser(employerUser);
    const workerId = await this.resolvePublicId(publicId);
    const jobs = await this.dataSource
      .getRepository(Job)
      .createQueryBuilder('job')
      .innerJoin('job.workers', 'w', 'w.id = :workerId', { workerId })
      .innerJoin('job.employer', 'emp', 'emp.id = :employerId', { employerId })
      .leftJoinAndSelect('job.client', 'client')
      .getMany();
    const byId = new Map<number, any>();
    for (const j of jobs) {
      const c = j.client;
      if (c && !byId.has(c.id)) {
        byId.set(c.id, {
          id: c.id,
          publicId: c.publicId,
          name: c.name || '',
          responsible: c.responsible || '',
          mobile: c.mobile || '',
          locality: (c as any).city || '',
          postalCode: c.postalCode || '',
        });
      }
    }
    return Array.from(byId.values());
  }

  /**
   * The employer's active workers, each flagged `available` = not assigned to
   * another (non-cancelled) job whose date range overlaps [startDate, endDate].
   * Suitability fields (occupation, locality) are returned for client-side filtering.
   */
  async findAvailableWorkers(
    employerUser: User,
    startDate?: string,
    endDate?: string,
  ) {
    const employerId = await this.resolveEmployerIdForUser(employerUser);

    const ewLinks = await this.employerWorkerRepo.find({
      where: { employer: { id: employerId }, isActive: true },
      relations: ['worker'],
    });
    const workers = ewLinks.map((l) => l.worker).filter(Boolean);
    const workerIds = workers.map((w) => w.id);

    const workerUsers = workerIds.length
      ? await this.workerUserRepo.find({
          where: workerIds.map((id) => ({ workerId: id })),
          relations: ['user'],
        })
      : [];
    const nameMap = new Map<number, string>();
    workerUsers.forEach((wu) => {
      if (wu.user) nameMap.set(wu.workerId, (wu.user as any).name);
    });

    let busyIds = new Set<number>();
    if (startDate && endDate) {
      const busy = await this.dataSource
        .getRepository(Job)
        .createQueryBuilder('job')
        .innerJoin('job.workers', 'w')
        .innerJoin('job.employer', 'emp', 'emp.id = :employerId', { employerId })
        .where('job.startDate <= :end', { end: new Date(endDate) })
        .andWhere('job.endDate >= :start', { start: new Date(startDate) })
        .andWhere('job.status != :cancelled', { cancelled: 'cancelled' })
        .select('w.id', 'wid')
        .distinct(true)
        .getRawMany();
      busyIds = new Set(busy.map((r) => Number(r.wid)));
    }

    return workers.map((w) => ({
      id: w.id,
      publicId: w.publicId,
      name: nameMap.get(w.id) || (w as any).code || `Worker #${w.id}`,
      occupation: (w as any).occupation || '',
      locality: (w as any).city || '',
      mobile: (w as any).mobile || '',
      available: !busyIds.has(w.id),
    }));
  }
}
