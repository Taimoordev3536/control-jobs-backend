import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AbsenceRequest } from './entities/absence-request.entity';
import { EmployerUser } from '../employers/entities/employer-user.entity';
import { EmployerWorker } from '../employers/entities/employer-worker.entity';
import { WorkerUser } from '../workers/entities/worker-user.entity';

@Injectable()
export class AbsencesService {
  constructor(
    @InjectRepository(AbsenceRequest) private absenceRepo: Repository<AbsenceRequest>,
    @InjectRepository(EmployerUser) private employerUserRepo: Repository<EmployerUser>,
    @InjectRepository(EmployerWorker) private employerWorkerRepo: Repository<EmployerWorker>,
    @InjectRepository(WorkerUser) private workerUserRepo: Repository<WorkerUser>,
  ) {}

  private map(a: AbsenceRequest) {
    return {
      id: a.publicId,
      workerName: a.worker?.user?.name || a.worker?.code || null,
      type: a.type,
      startDate: a.startDate,
      endDate: a.endDate,
      reason: a.reason,
      status: a.status,
      reviewerNotes: a.reviewerNotes,
      createdAt: a.createdAt,
    };
  }

  private async employerIdForUser(userId: number): Promise<number> {
    const link = await this.employerUserRepo.findOne({ where: { user: { id: userId } }, relations: ['employer'] });
    if (!link?.employer?.id) throw new NotFoundException('Employer not found for this user');
    return link.employer.id;
  }

  private async workerIdForUser(userId: number): Promise<number> {
    const link = await this.workerUserRepo.findOne({ where: { user: { id: userId } }, relations: ['worker'] });
    if (!link?.worker?.id) throw new ForbiddenException('Not a worker');
    return link.worker.id;
  }

  async listForEmployer(userId: number, status?: string) {
    const employerId = await this.employerIdForUser(userId);
    const where: any = { employerId };
    if (status) where.status = status;
    const rows = await this.absenceRepo.find({ where, relations: ['worker', 'worker.user'], order: { createdAt: 'DESC' } });
    return rows.map((a) => this.map(a));
  }

  async review(userId: number, publicId: string, body: { status?: string; reviewerNotes?: string }) {
    const employerId = await this.employerIdForUser(userId);
    const a = await this.absenceRepo.findOne({ where: { publicId, employerId }, relations: ['worker', 'worker.user'] });
    if (!a) throw new NotFoundException('Absence request not found');
    if (!['approved', 'rejected', 'pending'].includes(body.status || '')) throw new BadRequestException('Invalid status');
    a.status = body.status as string;
    a.reviewerNotes = body.reviewerNotes || null;
    a.reviewedByUserId = userId;
    a.reviewedAt = new Date();
    await this.absenceRepo.save(a);
    return this.map(a);
  }

  async createForWorker(userId: number, body: { type?: string; startDate?: string; endDate?: string; reason?: string }) {
    const workerId = await this.workerIdForUser(userId);
    if (!body.startDate || !body.endDate) throw new BadRequestException('startDate and endDate are required');
    if (body.endDate < body.startDate) throw new BadRequestException('endDate must be on or after startDate');

    const link = await this.employerWorkerRepo.findOne({ where: { worker: { id: workerId } }, relations: ['employer'] });
    const employerId = link?.employer?.id;
    if (!employerId) throw new BadRequestException('This worker is not linked to an employer');

    const rec = this.absenceRepo.create({
      workerId,
      employerId,
      type: body.type || 'vacation',
      startDate: body.startDate,
      endDate: body.endDate,
      reason: body.reason || null,
      status: 'pending',
      requestedByUserId: userId,
    });
    const saved = await this.absenceRepo.save(rec);
    return this.map(saved);
  }

  async listMine(userId: number) {
    const workerId = await this.workerIdForUser(userId);
    const rows = await this.absenceRepo.find({ where: { workerId }, relations: ['worker', 'worker.user'], order: { createdAt: 'DESC' } });
    return rows.map((a) => this.map(a));
  }
}
