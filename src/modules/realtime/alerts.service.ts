import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Notification } from './entities/notification.entity';
import { AlertsGateway } from './alerts.gateway';

export type AlertType =
  | 'CHECK_IN'
  | 'CHECK_OUT'
  | 'MANUAL_ATTENDANCE_REQUESTED'
  | 'MANUAL_ATTENDANCE_APPROVED'
  | 'MANUAL_ATTENDANCE_REJECTED'
  | 'MANUAL_ATTENDANCE_CANCELLED';
export interface AlertPayload {
  type: AlertType;
  jobId: number;
  jobPublicId?: string;
  workerId: number;
  workerPublicId?: string;
  employerUserId: number;
  clientUserId: number;
  message: string;
  createdAt?: string;
  meta?: Record<string, any>;
}

@Injectable()
export class AlertsService {
  constructor(
    @InjectRepository(Notification) private readonly notifRepo: Repository<Notification>,
    private readonly gateway: AlertsGateway,
  ) {}

  async createAndEmitAlert(payload: AlertPayload) {
    const createdAt = payload.createdAt ?? new Date().toISOString();
    // Log for diagnostics
    // eslint-disable-next-line no-console
    console.log('[ALERTS] Emitting', payload.type, 'job', payload.jobId, 'to employer', payload.employerUserId, 'and client', payload.clientUserId);

    // Persist for employer
    const notifEmployer = this.notifRepo.create({
      role: 'EMPLOYER',
      recipientId: payload.employerUserId,
      type: payload.type,
      message: payload.message,
      meta: {
        jobId: payload.jobId,
        jobPublicId: payload.jobPublicId,
        workerId: payload.workerId,
        workerPublicId: payload.workerPublicId,
        employerUserId: payload.employerUserId,
        clientUserId: payload.clientUserId,
        ...payload.meta,
      },
    });
    await this.notifRepo.save(notifEmployer);

    // Persist for client
    const notifClient = this.notifRepo.create({
      role: 'CLIENT',
      recipientId: payload.clientUserId,
      type: payload.type,
      message: payload.message,
      meta: {
        jobId: payload.jobId,
        jobPublicId: payload.jobPublicId,
        workerId: payload.workerId,
        workerPublicId: payload.workerPublicId,
        employerUserId: payload.employerUserId,
        clientUserId: payload.clientUserId,
        ...payload.meta,
      },
    });
    await this.notifRepo.save(notifClient);

    const event = { ...payload, createdAt };
    this.gateway.emitAlertToEmployer(payload.employerUserId, event);
    this.gateway.emitAlertToClient(payload.clientUserId, event);
  }

  async getRecentForRecipient(role: string, userId: number, days: number) {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);
    
    return this.notifRepo.createQueryBuilder('n')
      .where('n.role = :role', { role })
      .andWhere('n.recipient_id = :uid', { uid: userId })
      .andWhere('n.created_at >= :cutoff', { cutoff })
      .orderBy('n.created_at', 'DESC')
      .limit(100)
      .getMany();
  }

  async dismissForRecipient(publicId: string, role: string, userId: number) {
    const notif = await this.notifRepo.findOne({ where: { publicId, role, recipientId: userId } });
    if (notif) {
      await this.notifRepo.remove(notif);
    }
  }

  async pruneOlderThanDays(days: number) {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);
    await this.notifRepo.createQueryBuilder()
      .delete()
      .from(Notification)
      .where('created_at < :cutoff', { cutoff })
      .execute();
  }
}
