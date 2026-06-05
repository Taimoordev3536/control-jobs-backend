import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { LessThanOrEqual, Repository } from 'typeorm';
import { AlertsService } from '../../realtime/alerts.service';
import { Announcement } from '../entities/announcement.entity';
import { AudienceResolverService } from './audience-resolver.service';
import { AudienceSegment, AudienceSender } from '../audience.types';
import { CreateAnnouncementDto } from '../dto/create-announcement.dto';

@Injectable()
export class AnnouncementsService {
  private readonly logger = new Logger(AnnouncementsService.name);

  constructor(
    @InjectRepository(Announcement)
    private readonly repo: Repository<Announcement>,
    private readonly resolver: AudienceResolverService,
    private readonly alerts: AlertsService,
  ) {}

  async create(sender: AudienceSender, dto: CreateAnnouncementDto) {
    const segments = dto.segments as AudienceSegment[];
    this.resolver.assertSegmentsAllowed(sender.roleName, segments);

    const scheduledAt = dto.scheduledAt ? new Date(dto.scheduledAt) : null;
    if (scheduledAt && scheduledAt.getTime() <= Date.now()) {
      throw new BadRequestException('scheduledAt must be in the future');
    }

    const row = this.repo.create({
      senderUserId: sender.userId,
      senderRole: sender.roleName,
      segments,
      subject: dto.subject,
      body: dto.body,
      severity: dto.severity ?? 'INFO',
      scheduledAt,
      status: scheduledAt ? 'SCHEDULED' : 'SENT',
    });
    const saved = await this.repo.save(row);

    const finalRow = scheduledAt ? saved : await this.fanOut(saved);
    return this.toView(finalRow);
  }

  async fanOut(a: Announcement): Promise<Announcement> {
    const recipients = await this.resolver.resolve(
      { userId: a.senderUserId, roleName: a.senderRole as AudienceSender['roleName'] },
      a.segments as AudienceSegment[],
    );

    for (const r of recipients) {
      await this.alerts.createAndEmitForUser({
        userId: r.userId,
        role: r.role,
        type: 'ANNOUNCEMENT',
        message: a.body,
        meta: {
          announcementId: a.id,
          announcementPublicId: a.publicId,
          subject: a.subject,
          severity: a.severity,
          senderRole: a.senderRole,
        },
      });
    }

    a.recipientCount = recipients.length;
    a.status = 'SENT';
    a.sentAt = new Date();
    const saved = await this.repo.save(a);
    this.logger.log(
      `Announcement ${a.id} sent to ${recipients.length} recipient(s)`,
    );
    return saved;
  }

  async sendDue(): Promise<number> {
    const due = await this.repo.find({
      where: { status: 'SCHEDULED', scheduledAt: LessThanOrEqual(new Date()) },
    });
    let sent = 0;
    for (const a of due) {
      try {
        await this.fanOut(a);
        sent++;
      } catch (err: any) {
        a.status = 'FAILED';
        await this.repo.save(a);
        this.logger.error(
          `Scheduled announcement ${a.id} failed: ${err?.message}`,
          err?.stack,
        );
      }
    }
    return sent;
  }

  async cancel(publicId: string, senderUserId: number) {
    const a = await this.repo.findOne({ where: { publicId } });
    if (!a) throw new NotFoundException('Announcement not found');
    if (a.senderUserId !== senderUserId) {
      throw new ForbiddenException('This announcement is not yours');
    }
    if (a.status !== 'SCHEDULED') {
      throw new BadRequestException(
        'Only a scheduled announcement can be cancelled',
      );
    }
    a.status = 'CANCELLED';
    await this.repo.save(a);
    return this.toView(a);
  }

  async preview(sender: AudienceSender, segments: AudienceSegment[]) {
    this.resolver.assertSegmentsAllowed(sender.roleName, segments);
    const recipients = await this.resolver.resolve(sender, segments);
    return { recipientCount: recipients.length };
  }

  availableAudiences(sender: AudienceSender) {
    return this.resolver.availableAudiences(sender);
  }

  async listForSender(senderUserId: number, page = 1, limit = 20) {
    const [rows, total] = await this.repo.findAndCount({
      where: { senderUserId },
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });
    return { items: rows.map((r) => this.toView(r)), total, page, limit };
  }

  private toView(a: Announcement) {
    return {
      publicId: a.publicId,
      subject: a.subject,
      body: a.body,
      severity: a.severity,
      segments: a.segments,
      status: a.status,
      scheduledAt: a.scheduledAt,
      sentAt: a.sentAt,
      recipientCount: a.recipientCount,
      createdAt: a.createdAt,
    };
  }
}
