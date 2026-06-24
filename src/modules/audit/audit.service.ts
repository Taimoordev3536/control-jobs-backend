import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditLog } from './entities/audit-log.entity';
import { BaseResponse } from '../../common/interfaces/base-response.interface';

export interface AuditEntry {
  actorUserId?: number;
  actorName?: string;
  actorRole?: string;
  action: string;
  detail?: string;
}

@Injectable()
export class AuditService {
  constructor(
    @InjectRepository(AuditLog) private readonly auditRepo: Repository<AuditLog>,
  ) {}

  // Best-effort: an audit write must never break the action that triggered it.
  async record(entry: AuditEntry): Promise<void> {
    try {
      const log = this.auditRepo.create({
        actorUserId: entry.actorUserId ?? null,
        actorName: entry.actorName ?? null,
        actorRole: entry.actorRole ?? null,
        action: entry.action,
        detail: entry.detail ?? null,
      });
      await this.auditRepo.save(log);
    } catch (err) {
      console.error('[AUDIT] Failed to record', entry.action, err);
    }
  }

  async list(): Promise<BaseResponse<AuditLog[]>> {
    const data = await this.auditRepo.find({ order: { createdAt: 'DESC' }, take: 500 });
    return { message: 'Audit logs', data, isSuccess: true, statusCode: 200 };
  }
}
