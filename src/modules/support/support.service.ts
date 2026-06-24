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
import { BaseResponse } from '../../common/interfaces/base-response.interface';

@Injectable()
export class SupportService {
  constructor(
    @InjectRepository(SupportTicket) private readonly ticketRepo: Repository<SupportTicket>,
    @InjectRepository(Suggestion) private readonly suggestionRepo: Repository<Suggestion>,
    @InjectRepository(User) private readonly usersRepo: Repository<User>,
    private readonly alertsService: AlertsService,
    private readonly auditService: AuditService,
  ) {}

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
    await this.notifyAdmins('SUPPORT_REQUEST', `New support request from ${user.name ?? 'a user'}`, {
      ticketId: saved.id,
      ticketPublicId: saved.publicId,
    });
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

  async createSuggestion(user: any, dto: CreateSuggestionDto): Promise<BaseResponse<Suggestion>> {
    const suggestion = this.suggestionRepo.create({
      requesterUserId: user.id,
      requesterName: user.name ?? '',
      requesterRole: user.role?.name ?? '',
      message: dto.message,
    });
    const saved = await this.suggestionRepo.save(suggestion);
    await this.notifyAdmins('SUGGESTION', `New suggestion from ${user.name ?? 'a user'}`, {
      suggestionId: saved.id,
    });
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
