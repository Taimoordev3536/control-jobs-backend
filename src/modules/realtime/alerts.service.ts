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
  | 'MANUAL_ATTENDANCE_CANCELLED'
  | 'RATE_CHANGE_SCHEDULED'
  | 'RATE_CHANGE_CANCELLED'
  | 'ANNOUNCEMENT'
  | 'SUPPORT_REQUEST'
  | 'SUPPORT_REPLY'
  | 'SUGGESTION'
  | 'SURVEY_ALERT'
  | 'CLIENT_REQUEST_CREATED'
  | 'CLIENT_REQUEST_REVIEWED'
  | 'ABSENCE_REQUEST_CREATED'
  | 'ABSENCE_REQUEST_REVIEWED'
  | 'SURVEY_PUBLISHED'
  | 'SESSION_STILL_OPEN'
  | 'SESSION_AUTO_CLOSED';
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

    const meta = {
      jobId: payload.jobId,
      jobPublicId: payload.jobPublicId,
      workerId: payload.workerId,
      workerPublicId: payload.workerPublicId,
      employerUserId: payload.employerUserId,
      clientUserId: payload.clientUserId,
      ...payload.meta,
    };

    // The two notification rows are independent — persist them in parallel
    // (this runs on every check-in/out event, the hottest write path).
    const notifEmployer = this.notifRepo.create({
      role: 'EMPLOYER',
      recipientId: payload.employerUserId,
      type: payload.type,
      message: payload.message,
      meta,
    });
    const notifClient = this.notifRepo.create({
      role: 'CLIENT',
      recipientId: payload.clientUserId,
      type: payload.type,
      message: payload.message,
      meta,
    });
    const [savedEmployer, savedClient] = await Promise.all([
      this.notifRepo.save(notifEmployer),
      this.notifRepo.save(notifClient),
    ]);

    // Each recipient gets their OWN row's publicId so client-side dismiss
    // hits the right notification (the same alert is two DB rows, one per
    // recipient).
    this.gateway.emitAlertToEmployer(payload.employerUserId, {
      ...payload,
      id: savedEmployer.id,
      publicId: savedEmployer.publicId,
      createdAt,
    });
    this.gateway.emitAlertToClient(payload.clientUserId, {
      ...payload,
      id: savedClient.id,
      publicId: savedClient.publicId,
      createdAt,
    });
  }

  /**
   * Drop an alert on a single user — for events that aren't tied to a job
   * (e.g. billing notices). Persists + WS pushes to that user's room.
   */
  async createAndEmitForUser(args: {
    userId: number;
    role: 'EMPLOYER' | 'CLIENT' | 'WORKER' | 'PARTNER' | 'ADMIN';
    type: AlertType;
    message: string;
    meta?: Record<string, any>;
  }) {
    const notif = this.notifRepo.create({
      role: args.role,
      recipientId: args.userId,
      type: args.type,
      message: args.message,
      meta: args.meta ?? null,
    });
    const saved = await this.notifRepo.save(notif);
    this.gateway.emitAlertToUser(args.userId, {
      id: saved.id,
      publicId: saved.publicId,
      type: args.type,
      message: args.message,
      createdAt: saved.createdAt?.toISOString() ?? new Date().toISOString(),
      meta: args.meta ?? null,
    });
  }

  async listAnnouncementsForUser(userId: number) {
    const rows = await this.notifRepo.find({
      where: { recipientId: userId, type: 'ANNOUNCEMENT' },
      order: { createdAt: 'DESC' },
      take: 100,
    });
    return rows.map((n) => ({
      id: n.publicId,
      subject: n.meta?.subject || null,
      body: n.message,
      severity: n.meta?.severity || 'INFO',
      senderRole: n.meta?.senderRole || null,
      createdAt: n.createdAt,
      isRead: n.isRead,
    }));
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

  async countUnreadForRecipient(role: string, userId: number): Promise<number> {
    return this.notifRepo.count({
      where: { role, recipientId: userId, isRead: false },
    });
  }

  async markAllReadForRecipient(role: string, userId: number) {
    await this.notifRepo.update(
      { role, recipientId: userId, isRead: false },
      { isRead: true },
    );
  }

  async dismissForRecipient(publicId: string, role: string, userId: number) {
    const notif = await this.notifRepo.findOne({ where: { publicId, role, recipientId: userId } });
    if (notif) {
      await this.notifRepo.remove(notif);
    }
  }

  async dismissBannerForRecipient(publicId: string, role: string, userId: number) {
    await this.notifRepo.update(
      { publicId, role, recipientId: userId },
      { bannerDismissed: true },
    );
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
