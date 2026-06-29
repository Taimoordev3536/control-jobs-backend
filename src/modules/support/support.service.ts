import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SupportTicket } from './entities/support-ticket.entity';
import { Suggestion } from './entities/suggestion.entity';
import { User } from '../users/entities/user.entity';
import { UserRole } from '../auth/enums/user-role.enum';
import { AlertsService } from '../realtime/alerts.service';
import { AuditService } from '../audit/audit.service';
import { CreateTicketDto } from './dto/create-ticket.dto';
import { CreateSuggestionDto } from './dto/create-suggestion.dto';
import { ReplyTicketDto } from './dto/reply-ticket.dto';
import { BaseResponse } from '../../common/interfaces/base-response.interface';
import { NotFoundException } from '@nestjs/common';

@Injectable()
export class SupportService {
  constructor(
    @InjectRepository(SupportTicket) private readonly ticketRepo: Repository<SupportTicket>,
    @InjectRepository(Suggestion) private readonly suggestionRepo: Repository<Suggestion>,
    @InjectRepository(User) private readonly usersRepo: Repository<User>,
    private readonly alertsService: AlertsService,
    private readonly auditService: AuditService,
  ) {}

  private roleInSpanish(roleName?: string): string {
    switch (String(roleName ?? '').toLowerCase()) {
      case 'admin': return 'administrador';
      case 'partner': return 'partner';
      case 'employer': return 'empleador';
      case 'client': return 'cliente';
      case 'worker': return 'trabajador';
      default: return 'usuario';
    }
  }

  private async notifyAdmins(type: 'SUPPORT_REQUEST' | 'SUGGESTION', message: string, meta: Record<string, any>) {
    const admins = await this.usersRepo.find({
      where: { role: { value: UserRole.Admin } },
      relations: ['role'],
    });
    for (const admin of admins) {
      await this.alertsService.createAndEmitForUser({
        userId: admin.id,
        role: 'ADMIN',
        type,
        message,
        meta,
      });
    }
  }

  async createTicket(user: any, dto: CreateTicketDto): Promise<BaseResponse<SupportTicket>> {
    const ticket = this.ticketRepo.create({
      requesterUserId: user.id,
      requesterName: user.name ?? '',
      requesterRole: user.role?.name ?? '',
      subject: dto.subject ?? null,
      message: dto.message,
      status: 'OPEN',
    });
    const saved = await this.ticketRepo.save(ticket);
    await this.notifyAdmins(
      'SUPPORT_REQUEST',
      `Nueva solicitud de soporte del ${this.roleInSpanish(user.role?.name)} ${user.name ?? ''}`.trim(),
      {
        ticketId: saved.id,
        ticketPublicId: saved.publicId,
      },
    );
    await this.auditService.record({
      actorUserId: user.id,
      actorName: user.name,
      actorRole: user.role?.name,
      action: 'SUPPORT_TICKET_CREATED',
      detail: `Ticket #${saved.id}`,
    });
    return { message: 'Support request submitted', data: saved, isSuccess: true, statusCode: 201 };
  }

  async listTickets(): Promise<BaseResponse<SupportTicket[]>> {
    const data = await this.ticketRepo.find({ order: { createdAt: 'DESC' } });
    return { message: 'Tickets', data, isSuccess: true, statusCode: 200 };
  }

  private alertRoleOf(roleName?: string): 'EMPLOYER' | 'CLIENT' | 'WORKER' | 'PARTNER' | 'ADMIN' {
    switch (String(roleName ?? '').toLowerCase()) {
      case 'partner': return 'PARTNER';
      case 'employer': return 'EMPLOYER';
      case 'client': return 'CLIENT';
      case 'worker': return 'WORKER';
      default: return 'ADMIN';
    }
  }

  async replyToTicket(admin: any, publicId: string, dto: ReplyTicketDto): Promise<BaseResponse<SupportTicket>> {
    const ticket = await this.ticketRepo.findOne({ where: { publicId } });
    if (!ticket) {
      throw new NotFoundException('Ticket not found');
    }
    ticket.response = dto.response;
    ticket.respondedByName = admin?.name ?? 'Administrador';
    ticket.respondedAt = new Date();
    ticket.status = 'ANSWERED';
    const saved = await this.ticketRepo.save(ticket);

    await this.alertsService.createAndEmitForUser({
      userId: ticket.requesterUserId,
      role: this.alertRoleOf(ticket.requesterRole),
      type: 'SUPPORT_REPLY',
      message: `Respuesta de soporte: ${dto.response}`,
      meta: {
        ticketId: saved.id,
        ticketPublicId: saved.publicId,
      },
    });

    await this.auditService.record({
      actorUserId: admin?.id,
      actorName: admin?.name,
      actorRole: admin?.role?.name,
      action: 'SUPPORT_TICKET_ANSWERED',
      detail: `Ticket #${saved.id}`,
    });

    return { message: 'Reply sent', data: saved, isSuccess: true, statusCode: 200 };
  }

  async createSuggestion(user: any, dto: CreateSuggestionDto): Promise<BaseResponse<Suggestion>> {
    const suggestion = this.suggestionRepo.create({
      requesterUserId: user.id,
      requesterName: user.name ?? '',
      requesterRole: user.role?.name ?? '',
      message: dto.message,
    });
    const saved = await this.suggestionRepo.save(suggestion);
    await this.notifyAdmins(
      'SUGGESTION',
      `Nueva sugerencia del ${this.roleInSpanish(user.role?.name)} ${user.name ?? ''}`.trim(),
      {
        suggestionId: saved.id,
      },
    );
    await this.auditService.record({
      actorUserId: user.id,
      actorName: user.name,
      actorRole: user.role?.name,
      action: 'SUGGESTION_CREATED',
      detail: `Suggestion #${saved.id}`,
    });
    return { message: 'Suggestion submitted', data: saved, isSuccess: true, statusCode: 201 };
  }

  async listSuggestions(): Promise<BaseResponse<Suggestion[]>> {
    const data = await this.suggestionRepo.find({ order: { createdAt: 'DESC' } });
    return { message: 'Suggestions', data, isSuccess: true, statusCode: 200 };
  }
}
