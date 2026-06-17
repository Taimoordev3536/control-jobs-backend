import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { PartnerUser } from '../../partners/entities/partner-user.entity';
import { Employer } from '../../employers/entities/employer.entity';
import { EmployerUser } from '../../employers/entities/employer-user.entity';
import { EmployerClient } from '../../employers/entities/employer-client.entity';
import { EmployerWorker } from '../../employers/entities/employer-worker.entity';
import { ClientUser } from '../../clients/entities/client-user.entity';
import { WorkerUser } from '../../workers/entities/worker-user.entity';
import {
  AudienceSegment,
  AudienceSender,
  Recipient,
  SEGMENTS_BY_SENDER_ROLE,
  SenderRole,
} from '../audience.types';

@Injectable()
export class AudienceResolverService {
  constructor(
    @InjectRepository(PartnerUser)
    private readonly partnerUserRepo: Repository<PartnerUser>,
    @InjectRepository(Employer)
    private readonly employerRepo: Repository<Employer>,
    @InjectRepository(EmployerUser)
    private readonly employerUserRepo: Repository<EmployerUser>,
    @InjectRepository(EmployerClient)
    private readonly employerClientRepo: Repository<EmployerClient>,
    @InjectRepository(EmployerWorker)
    private readonly employerWorkerRepo: Repository<EmployerWorker>,
    @InjectRepository(ClientUser)
    private readonly clientUserRepo: Repository<ClientUser>,
    @InjectRepository(WorkerUser)
    private readonly workerUserRepo: Repository<WorkerUser>,
  ) {}

  assertSegmentsAllowed(role: SenderRole, segments: AudienceSegment[]): void {
    const allowed = SEGMENTS_BY_SENDER_ROLE[role] ?? [];
    if (!segments.length) {
      throw new ForbiddenException('At least one audience must be selected');
    }
    const bad = segments.filter((s) => !allowed.includes(s));
    if (bad.length) {
      throw new ForbiddenException(
        `Your role cannot send to: ${bad.join(', ')}`,
      );
    }
  }

  async resolve(
    sender: AudienceSender,
    segments: AudienceSegment[],
  ): Promise<Recipient[]> {
    this.assertSegmentsAllowed(sender.roleName, segments);
    const collected: Recipient[] = [];
    for (const seg of segments) {
      collected.push(...(await this.resolveSegment(sender, seg)));
    }
    const byUser = new Map<number, Recipient>();
    for (const r of collected) {
      if (r.userId !== sender.userId && !byUser.has(r.userId)) {
        byUser.set(r.userId, r);
      }
    }
    return [...byUser.values()];
  }

  async availableAudiences(
    sender: AudienceSender,
  ): Promise<{ segment: AudienceSegment; count: number }[]> {
    const segments = SEGMENTS_BY_SENDER_ROLE[sender.roleName] ?? [];
    const out: { segment: AudienceSegment; count: number }[] = [];
    for (const segment of segments) {
      const recipients = await this.resolveSegment(sender, segment);
      const count = new Set(
        recipients.map((r) => r.userId).filter((id) => id !== sender.userId),
      ).size;
      out.push({ segment, count });
    }
    return out;
  }

  private async resolveSegment(
    sender: AudienceSender,
    segment: AudienceSegment,
  ): Promise<Recipient[]> {
    switch (segment) {
      case 'ALL_PARTNERS':
        return this.tag(await this.allPartnerUserIds(), 'PARTNER');
      case 'ALL_EMPLOYERS':
        return this.tag(await this.employerUserIds(), 'EMPLOYER');
      case 'ALL_CLIENTS':
        return this.tag(await this.allClientUserIds(), 'CLIENT');
      case 'ALL_WORKERS':
        return this.tag(await this.allWorkerUserIds(), 'WORKER');
      case 'MY_EMPLOYERS': {
        const partnerId = await this.partnerIdOf(sender.userId);
        const employerIds = await this.employerIdsOfPartner(partnerId);
        return this.tag(await this.employerUserIds(employerIds), 'EMPLOYER');
      }
      case 'MY_CLIENTS': {
        const employerId = await this.employerIdOf(sender.userId);
        const clientIds = await this.clientIdsOfEmployer(employerId);
        return this.tag(await this.clientUserIds(clientIds), 'CLIENT');
      }
      case 'MY_WORKERS': {
        const employerId = await this.employerIdOf(sender.userId);
        const workerIds = await this.workerIdsOfEmployer(employerId);
        return this.tag(await this.workerUserIds(workerIds), 'WORKER');
      }
      default:
        return [];
    }
  }

  private tag(userIds: number[], role: Recipient['role']): Recipient[] {
    return userIds.map((userId) => ({ userId, role }));
  }

  private async partnerIdOf(userId: number): Promise<number> {
    const link = await this.partnerUserRepo.findOne({ where: { userId } });
    if (!link?.partnerId) {
      throw new NotFoundException('No partner is linked to the current user');
    }
    return link.partnerId;
  }

  private async employerIdOf(userId: number): Promise<number> {
    const link = await this.employerUserRepo.findOne({
      where: { user: { id: userId } },
      relations: ['employer'],
    });
    if (!link?.employer?.id) {
      throw new NotFoundException('No employer is linked to the current user');
    }
    return link.employer.id;
  }

  private async employerIdsOfPartner(partnerId: number): Promise<number[]> {
    const employers = await this.employerRepo.find({
      where: { partnerId },
      select: ['id'],
    });
    return employers.map((e) => e.id);
  }

  private async clientIdsOfEmployer(employerId: number): Promise<number[]> {
    const rows = await this.employerClientRepo
      .createQueryBuilder('ec')
      .innerJoin('ec.employer', 'e')
      .innerJoin('ec.client', 'c')
      .where('e.id = :employerId', { employerId })
      .andWhere('ec.isActive = true')
      .select('c.id', 'id')
      .getRawMany<{ id: number }>();
    return rows.map((r) => Number(r.id));
  }

  private async workerIdsOfEmployer(employerId: number): Promise<number[]> {
    const rows = await this.employerWorkerRepo
      .createQueryBuilder('ew')
      .innerJoin('ew.employer', 'e')
      .innerJoin('ew.worker', 'w')
      .where('e.id = :employerId', { employerId })
      .andWhere('ew.isActive = true')
      .select('w.id', 'id')
      .getRawMany<{ id: number }>();
    return rows.map((r) => Number(r.id));
  }

  private async allPartnerUserIds(): Promise<number[]> {
    const rows = await this.partnerUserRepo
      .createQueryBuilder('pu')
      .select('pu.userId', 'id')
      .getRawMany<{ id: number }>();
    return rows.map((r) => Number(r.id));
  }

  private async employerUserIds(employerIds?: number[]): Promise<number[]> {
    if (employerIds && employerIds.length === 0) return [];
    const qb = this.employerUserRepo
      .createQueryBuilder('eu')
      .innerJoin('eu.user', 'u')
      .select('u.id', 'id');
    if (employerIds) {
      qb.innerJoin('eu.employer', 'e').where('e.id IN (:...ids)', {
        ids: employerIds,
      });
    }
    const rows = await qb.getRawMany<{ id: number }>();
    return rows.map((r) => Number(r.id));
  }

  private async allClientUserIds(): Promise<number[]> {
    const rows = await this.clientUserRepo
      .createQueryBuilder('cu')
      .select('cu.userId', 'id')
      .getRawMany<{ id: number }>();
    return rows.map((r) => Number(r.id));
  }

  private async allWorkerUserIds(): Promise<number[]> {
    const rows = await this.workerUserRepo
      .createQueryBuilder('wu')
      .select('wu.userId', 'id')
      .getRawMany<{ id: number }>();
    return rows.map((r) => Number(r.id));
  }

  private async clientUserIds(clientIds: number[]): Promise<number[]> {
    if (!clientIds.length) return [];
    const rows = await this.clientUserRepo.find({
      where: { clientId: In(clientIds) },
      select: ['userId'],
    });
    return rows.map((r) => r.userId);
  }

  private async workerUserIds(workerIds: number[]): Promise<number[]> {
    if (!workerIds.length) return [];
    const rows = await this.workerUserRepo.find({
      where: { workerId: In(workerIds) },
      select: ['userId'],
    });
    return rows.map((r) => r.userId);
  }
}
