import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ClientRequest } from './entities/client-request.entity';
import { ClientUser } from '../clients/entities/client-user.entity';
import { Job } from '../job/entities/job.entity';
import { EmployerClient } from '../employers/entities/employer-client.entity';
import { EmployerUser } from '../employers/entities/employer-user.entity';

@Injectable()
export class ClientRequestsService {
  constructor(
    @InjectRepository(ClientRequest) private requestRepo: Repository<ClientRequest>,
    @InjectRepository(ClientUser) private clientUserRepo: Repository<ClientUser>,
    @InjectRepository(Job) private jobRepo: Repository<Job>,
    @InjectRepository(EmployerClient) private employerClientRepo: Repository<EmployerClient>,
    @InjectRepository(EmployerUser) private employerUserRepo: Repository<EmployerUser>,
  ) {}

  private map(r: ClientRequest) {
    return {
      id: r.publicId,
      type: r.type,
      jobName: r.job?.jobName || null,
      subject: r.subject,
      description: r.description,
      startDate: r.startDate,
      endDate: r.endDate,
      status: r.status,
      reviewerNotes: r.reviewerNotes,
      createdAt: r.createdAt,
      clientName: r.client?.name || r.client?.code || null,
    };
  }

  private async clientIdForUser(userId: number): Promise<number> {
    const link = await this.clientUserRepo.findOne({ where: { user: { id: userId } }, relations: ['client'] });
    if (!link?.client?.id) throw new ForbiddenException('Not a client');
    return link.client.id;
  }

  private async employerIdForClient(clientId: number): Promise<number> {
    const job = await this.jobRepo.findOne({ where: { client: { id: clientId } }, relations: ['employer', 'client'] });
    if (job?.employer?.id) return job.employer.id;
    const link = await this.employerClientRepo.findOne({ where: { client: { id: clientId } }, relations: ['employer'] });
    if (link?.employer?.id) return link.employer.id;
    throw new BadRequestException('This client is not linked to an employer');
  }

  private async employerIdForUser(userId: number): Promise<number> {
    const link = await this.employerUserRepo.findOne({ where: { user: { id: userId } }, relations: ['employer'] });
    if (!link?.employer?.id) throw new NotFoundException('Employer not found for this user');
    return link.employer.id;
  }

  async createForClient(
    userId: number,
    dto: { type?: string; jobPublicId?: string; subject?: string; description?: string; startDate?: string; endDate?: string },
  ) {
    const clientId = await this.clientIdForUser(userId);
    if (!['new_job', 'change', 'absence'].includes(dto.type || '')) throw new BadRequestException('Invalid type');
    const employerId = await this.employerIdForClient(clientId);

    let jobId: number | null = null;
    if (dto.type === 'change' && dto.jobPublicId) {
      const job = await this.jobRepo.findOne({ where: { publicId: dto.jobPublicId } });
      if (!job) throw new NotFoundException('Job not found');
      jobId = job.id;
    }

    const rec = this.requestRepo.create({
      clientId,
      employerId,
      type: dto.type as string,
      jobId,
      subject: dto.subject || null,
      description: dto.description || null,
      startDate: dto.startDate || null,
      endDate: dto.endDate || null,
      status: 'pending',
    });
    const saved = await this.requestRepo.save(rec);
    const full = await this.requestRepo.findOne({ where: { id: saved.id }, relations: ['job', 'client'] });
    return this.map(full || saved);
  }

  async listMine(userId: number) {
    const clientId = await this.clientIdForUser(userId);
    const rows = await this.requestRepo.find({ where: { clientId }, relations: ['job', 'client'], order: { createdAt: 'DESC' } });
    return rows.map((r) => this.map(r));
  }

  async listForEmployer(userId: number) {
    const employerId = await this.employerIdForUser(userId);
    const rows = await this.requestRepo.find({ where: { employerId }, relations: ['job', 'client'], order: { createdAt: 'DESC' } });
    return rows.map((r) => this.map(r));
  }

  async review(userId: number, publicId: string, body: { status?: string; reviewerNotes?: string }) {
    const employerId = await this.employerIdForUser(userId);
    const r = await this.requestRepo.findOne({ where: { publicId, employerId }, relations: ['job', 'client'] });
    if (!r) throw new NotFoundException('Request not found');
    if (!['pending', 'accepted', 'rejected'].includes(body.status || '')) throw new BadRequestException('Invalid status');
    r.status = body.status as string;
    r.reviewerNotes = body.reviewerNotes || null;
    await this.requestRepo.save(r);
    return this.map(r);
  }
}
