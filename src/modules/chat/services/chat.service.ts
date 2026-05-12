import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, IsNull, LessThan, Not, Repository } from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { AdminUser } from '../../users/entities/admin-user.entity';
import { PartnerUser } from '../../partners/entities/partner-user.entity';
import { Partner } from '../../partners/entities/partner.entity';
import { PartnerTier } from '../../partners/entities/partner-type.entity';
import { EmployerUser } from '../../employers/entities/employer-user.entity';
import { Employer } from '../../employers/entities/employer.entity';
import { EmployerClient } from '../../employers/entities/employer-client.entity';
import { EmployerWorker } from '../../employers/entities/employer-worker.entity';
import { ClientUser } from '../../clients/entities/client-user.entity';
import { Client } from '../../clients/entities/client.entity';
import { WorkerUser } from '../../workers/entities/worker-user.entity';
import { Worker } from '../../workers/entities/worker.entity';
import { UserRole } from '../../auth/enums/user-role.enum';
import { Conversation } from '../entities/conversation.entity';
import { ConversationParticipant } from '../entities/conversation-participant.entity';
import { Message } from '../entities/message.entity';
import { MessageRead } from '../entities/message-read.entity';
import { MessageReaction } from '../entities/message-reaction.entity';
import { MessageAttachment } from '../entities/message-attachment.entity';
import { CloudinaryService } from '../../cloudinary/cloudinary.service';
import { AttachmentKind } from '../enums/chat.enums';
import { ConversationKind, ParticipantType } from '../enums/chat.enums';
import {
  ADMIN_ENTITY_ID,
  ALLOWED_IMAGE_MIME,
  ALLOWED_PDF_MIME,
  MAX_ATTACHMENTS_PER_MESSAGE,
  MAX_IMAGE_BYTES,
  MAX_PDF_BYTES,
  MESSAGE_PAGE_SIZE,
  SEARCH_PAGE_SIZE,
} from '../chat.constants';
import { ChatGateway } from '../gateway/chat.gateway';

export type PartnerTierName = 'Gold' | 'Silver' | 'Bronze' | 'Affiliate';

export interface RequesterScope {
  userId: number;
  participantType: ParticipantType;
  participantEntityId: number;
  participantEntityPublicId: string | null;
  displayName: string;
  partnerTier?: PartnerTierName | null;
}

interface ParticipantRef {
  type: ParticipantType;
  entityId: number;
}

export interface EntityRef {
  id: number;
  publicId: string | null;
  name: string;
  // Identity image used by the chat contacts picker. Employers contribute
  // profilePhotoUrl; every other role contributes logoUrl (their avatar).
  // Optional because some internal lookups (resolveEntityByPublicId) only
  // need name/id and don't bother fetching the photo.
  imageUrl?: string | null;
  isSelf?: boolean;
}

@Injectable()
export class ChatService {
  constructor(
    @InjectRepository(Conversation) private readonly conversationRepo: Repository<Conversation>,
    @InjectRepository(ConversationParticipant) private readonly participantRepo: Repository<ConversationParticipant>,
    @InjectRepository(Message) private readonly messageRepo: Repository<Message>,
    @InjectRepository(MessageRead) private readonly readRepo: Repository<MessageRead>,
    @InjectRepository(MessageReaction) private readonly reactionRepo: Repository<MessageReaction>,
    @InjectRepository(MessageAttachment) private readonly attachmentRepo: Repository<MessageAttachment>,
    private readonly cloudinary: CloudinaryService,
    @InjectRepository(User) private readonly userRepo: Repository<User>,
    @InjectRepository(AdminUser) private readonly adminUserRepo: Repository<AdminUser>,
    @InjectRepository(PartnerUser) private readonly partnerUserRepo: Repository<PartnerUser>,
    @InjectRepository(Partner) private readonly partnerRepo: Repository<Partner>,
    @InjectRepository(PartnerTier) private readonly partnerTierRepo: Repository<PartnerTier>,
    @InjectRepository(EmployerUser) private readonly employerUserRepo: Repository<EmployerUser>,
    @InjectRepository(Employer) private readonly employerRepo: Repository<Employer>,
    @InjectRepository(EmployerClient) private readonly employerClientRepo: Repository<EmployerClient>,
    @InjectRepository(EmployerWorker) private readonly employerWorkerRepo: Repository<EmployerWorker>,
    @InjectRepository(ClientUser) private readonly clientUserRepo: Repository<ClientUser>,
    @InjectRepository(Client) private readonly clientRepo: Repository<Client>,
    @InjectRepository(WorkerUser) private readonly workerUserRepo: Repository<WorkerUser>,
    @InjectRepository(Worker) private readonly workerRepo: Repository<Worker>,
    private readonly dataSource: DataSource,
    private readonly gateway: ChatGateway,
  ) {}

  async resolveRequesterScope(requester: any): Promise<RequesterScope> {
    const userId: number = requester?.id;
    const roleValue: number = requester?.role?.value ?? this.roleNameToValue(requester?.role?.name);
    if (!userId) throw new UnauthorizedException('Invalid requester');

    if (roleValue === UserRole.Admin) {
      return {
        userId,
        participantType: ParticipantType.Admin,
        participantEntityId: ADMIN_ENTITY_ID,
        participantEntityPublicId: null,
        displayName: requester.name || 'Admin',
      };
    }

    if (roleValue === UserRole.Partner) {
      const link = await this.partnerUserRepo.findOne({
        where: { userId },
        relations: ['partner'],
      });
      if (!link?.partner) throw new ForbiddenException('No partner linked to this user');
      const partnerTier = await this.resolvePartnerTier(link.partner.partnerTierId);
      return {
        userId,
        participantType: ParticipantType.Partner,
        participantEntityId: link.partner.id,
        participantEntityPublicId: link.partner.publicId,
        displayName: link.partner.name,
        partnerTier,
      };
    }

    if (roleValue === UserRole.Employer) {
      const link = await this.employerUserRepo.findOne({
        where: { user: { id: userId } },
        relations: ['employer'],
      });
      if (!link?.employer) throw new ForbiddenException('No employer linked to this user');
      return {
        userId,
        participantType: ParticipantType.Employer,
        participantEntityId: link.employer.id,
        participantEntityPublicId: link.employer.publicId,
        displayName: link.employer.name,
      };
    }

    if (roleValue === UserRole.Client) {
      const link = await this.clientUserRepo.findOne({
        where: { userId },
        relations: ['client'],
      });
      if (!link?.client) throw new ForbiddenException('No client linked to this user');
      return {
        userId,
        participantType: ParticipantType.Client,
        participantEntityId: link.client.id,
        participantEntityPublicId: link.client.publicId,
        displayName: link.client.name || link.client.code,
      };
    }

    if (roleValue === UserRole.Worker) {
      const link = await this.workerUserRepo.findOne({
        where: { userId },
        relations: ['worker'],
      });
      if (!link?.worker) throw new ForbiddenException('No worker linked to this user');
      const displayName = await this.resolveWorkerName(link.worker.id, link.worker.code);
      return {
        userId,
        participantType: ParticipantType.Worker,
        participantEntityId: link.worker.id,
        participantEntityPublicId: link.worker.publicId,
        displayName,
      };
    }

    throw new ForbiddenException('Role not supported for chat');
  }

  private async resolvePartnerTier(tierId?: number | null): Promise<PartnerTierName | null> {
    if (!tierId) return null;
    const tier = await this.partnerTierRepo.findOne({ where: { id: tierId } });
    const raw = (tier?.name || '').trim();
    if (raw === 'Gold' || raw === 'Silver' || raw === 'Bronze' || raw === 'Affiliate') {
      return raw;
    }
    return null;
  }

  private isHighTierPartner(scope: RequesterScope): boolean {
    return (
      scope.participantType === ParticipantType.Partner &&
      (scope.partnerTier === 'Gold' || scope.partnerTier === 'Silver')
    );
  }

  private roleNameToValue(name?: string): number | undefined {
    if (!name) return undefined;
    const map: Record<string, number> = {
      ADMIN: UserRole.Admin,
      PARTNER: UserRole.Partner,
      EMPLOYER: UserRole.Employer,
      CLIENT: UserRole.Client,
      WORKER: UserRole.Worker,
    };
    return map[name.toUpperCase()];
  }

  async getMyScope(requester: any) {
    const scope = await this.resolveRequesterScope(requester);
    const canCreateGroup =
      scope.participantType === ParticipantType.Admin ||
      scope.participantType === ParticipantType.Employer ||
      this.isHighTierPartner(scope);
    return {
      participantType: scope.participantType,
      participantEntityPublicId: scope.participantEntityPublicId,
      displayName: scope.displayName,
      partnerTier: scope.partnerTier ?? null,
      canCreateGroup,
    };
  }

  async listConversations(requester: any) {
    const scope = await this.resolveRequesterScope(requester);
    const myConversations = await this.findConversationsForScope(scope);
    if (myConversations.length === 0) return [];

    const conversationIds = myConversations.map((c) => c.id);
    const participants = await this.participantRepo.find({
      where: { conversationId: In(conversationIds) },
    });
    const entityInfoMap = await this.bulkResolveEntityInfo(participants);

    const lastMessages = await this.fetchLastMessagesByConversation(conversationIds);
    const unreadCounts = await this.fetchUnreadCounts(conversationIds, scope.userId);

    const result = myConversations.map((conv) => {
      const convParticipants = participants.filter((p) => p.conversationId === conv.id);
      const others = convParticipants.filter(
        (p) => !(p.participantType === scope.participantType && p.participantEntityId === scope.participantEntityId),
      );
      const displayName = others
        .map((p) => entityInfoMap[`${p.participantType}:${p.participantEntityId}`]?.name || 'Sin nombre')
        .join(' · ');
      // For 1:1 DMs the avatar is the other participant's photo. For groups
      // there's no single photo to pick — the list/header renders a group
      // icon instead, so leave displayImageUrl null.
      const displayImageUrl =
        others.length === 1
          ? entityInfoMap[`${others[0].participantType}:${others[0].participantEntityId}`]?.imageUrl ?? null
          : null;
      const last = lastMessages[conv.id];
      return {
        publicId: conv.publicId,
        kind: conv.kind,
        displayName,
        displayImageUrl,
        participants: convParticipants.map((p) => {
          const info = entityInfoMap[`${p.participantType}:${p.participantEntityId}`];
          return {
            type: p.participantType,
            entityId: p.participantEntityId,
            name: info?.name || null,
            imageUrl: info?.imageUrl ?? null,
          };
        }),
        lastMessage: last
          ? {
              publicId: last.publicId,
              body: last.deletedAt ? null : last.body,
              senderUserId: last.senderUserId,
              createdAt: last.createdAt,
              deletedAt: last.deletedAt,
              attachmentCount: last.deletedAt ? 0 : (last.attachments?.length || 0),
              firstAttachmentKind: last.deletedAt
                ? null
                : (last.attachments?.[0]?.kind || null),
              firstAttachmentName: last.deletedAt
                ? null
                : (last.attachments?.[0]?.originalName || null),
            }
          : null,
        lastMessageAt: conv.lastMessageAt,
        unreadCount: unreadCounts[conv.id] || 0,
        createdAt: conv.createdAt,
      };
    });

    return result.sort((a, b) => {
      const at = a.lastMessageAt?.getTime() || a.createdAt.getTime();
      const bt = b.lastMessageAt?.getTime() || b.createdAt.getTime();
      return bt - at;
    });
  }

  async getMessages(requester: any, conversationPublicId: string, beforePublicId?: string, limit = MESSAGE_PAGE_SIZE) {
    const scope = await this.resolveRequesterScope(requester);
    const conversation = await this.findConversationOrThrow(conversationPublicId);
    await this.assertParticipant(conversation.id, scope);

    let beforeId: string | undefined;
    if (beforePublicId) {
      const cursor = await this.messageRepo.findOne({ where: { publicId: beforePublicId } });
      if (cursor) beforeId = cursor.id;
    }

    const where: any = { conversationId: conversation.id };
    if (beforeId) where.id = LessThan(beforeId);

    const rows = await this.messageRepo.find({
      where,
      order: { id: 'DESC' },
      take: Math.min(limit, MESSAGE_PAGE_SIZE),
      relations: ['senderUser', 'reads', 'reactions', 'attachments', 'repliedToMessage', 'repliedToMessage.senderUser', 'repliedToMessage.attachments'],
    });

    return rows.reverse().map((m) => this.toMessageDto(m, conversation.publicId));
  }

  async createDirect(requester: any, targetType: ParticipantType, targetEntityPublicId?: string) {
    const scope = await this.resolveRequesterScope(requester);
    if (targetType === scope.participantType && targetType !== ParticipantType.Admin) {
      throw new BadRequestException('Cannot chat with the same entity');
    }
    if (targetType !== ParticipantType.Admin && !targetEntityPublicId) {
      throw new BadRequestException('targetEntityPublicId is required');
    }
    const target =
      targetType === ParticipantType.Admin
        ? { id: ADMIN_ENTITY_ID, publicId: null, name: 'Admin' }
        : await this.resolveEntityByPublicId(targetType, targetEntityPublicId!);
    await this.assertCanChatDirect(scope, { type: targetType, entityId: target.id });

    const existing = await this.findDirectConversation(scope, { type: targetType, entityId: target.id });
    if (existing) return this.buildConversationDetail(existing, scope);

    const conv = await this.createConversation(scope.userId, ConversationKind.Direct, [
      { type: scope.participantType, entityId: scope.participantEntityId },
      { type: targetType, entityId: target.id },
    ]);
    return this.buildConversationDetail(conv, scope);
  }

  async createGroup(requester: any, employerPublicId: string, clientPublicId: string, workerPublicId: string) {
    const scope = await this.resolveRequesterScope(requester);
    const employer = await this.resolveEntityByPublicId(ParticipantType.Employer, employerPublicId);
    const client = await this.resolveEntityByPublicId(ParticipantType.Client, clientPublicId);
    const worker = await this.resolveEntityByPublicId(ParticipantType.Worker, workerPublicId);

    await this.assertCanCreateGroup(scope, employer.id, client.id, worker.id);

    const existing = await this.findGroupConversation(employer.id, client.id, worker.id);
    if (existing) return this.buildConversationDetail(existing, scope);

    const conv = await this.createConversation(scope.userId, ConversationKind.Group, [
      { type: ParticipantType.Employer, entityId: employer.id },
      { type: ParticipantType.Client, entityId: client.id },
      { type: ParticipantType.Worker, entityId: worker.id },
    ]);
    return this.buildConversationDetail(conv, scope);
  }

  async sendMessage(
    requester: any,
    conversationPublicId: string,
    body: string,
    repliedToMessagePublicId?: string,
  ) {
    const scope = await this.resolveRequesterScope(requester);
    const conversation = await this.findConversationOrThrow(conversationPublicId);
    await this.assertParticipant(conversation.id, scope);

    let repliedToId: string | null = null;
    if (repliedToMessagePublicId) {
      const target = await this.messageRepo.findOne({
        where: { publicId: repliedToMessagePublicId, conversationId: conversation.id },
      });
      if (!target) throw new NotFoundException('Replied message not found');
      repliedToId = target.id;
    }

    const now = new Date();
    const message = await this.messageRepo.save(
      this.messageRepo.create({
        conversationId: conversation.id,
        senderUserId: scope.userId,
        senderEntityType: scope.participantType,
        senderEntityId: scope.participantEntityId,
        body,
        repliedToMessageId: repliedToId,
        createdAt: now,
      }),
    );

    await this.conversationRepo.update(conversation.id, { lastMessageAt: now });

    const fullMessage = await this.messageRepo.findOne({
      where: { id: message.id },
      relations: ['senderUser', 'reads', 'reactions', 'attachments', 'repliedToMessage', 'repliedToMessage.senderUser', 'repliedToMessage.attachments'],
    });
    const dto = this.toMessageDto(fullMessage!, conversation.publicId);

    this.gateway.emitMessageNew(conversation.publicId, dto);
    await this.notifyConversationUpsert(conversation.id);

    return dto;
  }

  async sendMessageWithAttachments(
    requester: any,
    conversationPublicId: string,
    files: Express.Multer.File[],
    body?: string,
    repliedToMessagePublicId?: string,
  ) {
    const scope = await this.resolveRequesterScope(requester);
    const conversation = await this.findConversationOrThrow(conversationPublicId);
    await this.assertParticipant(conversation.id, scope);

    if (!files || files.length === 0) {
      throw new BadRequestException('At least one file is required');
    }
    if (files.length > MAX_ATTACHMENTS_PER_MESSAGE) {
      throw new BadRequestException(`At most ${MAX_ATTACHMENTS_PER_MESSAGE} files per message`);
    }

    const classified = files.map((file) => {
      if (ALLOWED_IMAGE_MIME.has(file.mimetype)) {
        if (file.size > MAX_IMAGE_BYTES) {
          throw new BadRequestException(`Image ${file.originalname} exceeds 10MB`);
        }
        return { file, kind: AttachmentKind.Image };
      }
      if (ALLOWED_PDF_MIME.has(file.mimetype)) {
        if (file.size > MAX_PDF_BYTES) {
          throw new BadRequestException(`PDF ${file.originalname} exceeds 25MB`);
        }
        return { file, kind: AttachmentKind.Pdf };
      }
      throw new BadRequestException(`Unsupported file type: ${file.mimetype}`);
    });

    let repliedToId: string | null = null;
    if (repliedToMessagePublicId) {
      const target = await this.messageRepo.findOne({
        where: { publicId: repliedToMessagePublicId, conversationId: conversation.id },
      });
      if (!target) throw new NotFoundException('Replied message not found');
      repliedToId = target.id;
    }

    const folder = `controljobs/chat-attachments/${conversation.publicId}`;
    const uploaded = await Promise.all(
      classified.map(({ file, kind }) =>
        this.cloudinary.uploadAttachment(
          file.buffer,
          folder,
          kind === AttachmentKind.Image ? 'image' : 'raw',
        ),
      ),
    );

    const now = new Date();
    const result = await this.dataSource.transaction(async (manager) => {
      const message = await manager.save(
        manager.create(Message, {
          conversationId: conversation.id,
          senderUserId: scope.userId,
          senderEntityType: scope.participantType,
          senderEntityId: scope.participantEntityId,
          body: body && body.trim() ? body.trim() : null,
          repliedToMessageId: repliedToId,
          createdAt: now,
        }),
      );

      const rows = classified.map(({ file, kind }, idx) => {
        const up = uploaded[idx];
        return manager.create(MessageAttachment, {
          messageId: message.id,
          kind,
          url: up.secureUrl,
          cloudinaryId: up.publicId,
          mimeType: file.mimetype,
          sizeBytes: up.bytes ?? file.size,
          width: up.width,
          height: up.height,
          originalName: file.originalname,
          position: idx,
        });
      });
      await manager.save(rows);

      await manager.update(Conversation, conversation.id, { lastMessageAt: now });
      return message.id;
    });

    const fullMessage = await this.messageRepo.findOne({
      where: { id: result },
      relations: ['senderUser', 'reads', 'reactions', 'attachments', 'repliedToMessage', 'repliedToMessage.senderUser', 'repliedToMessage.attachments'],
    });
    const dto = this.toMessageDto(fullMessage!, conversation.publicId);

    this.gateway.emitMessageNew(conversation.publicId, dto);
    await this.notifyConversationUpsert(conversation.id);

    return dto;
  }

  async setPinned(
    requester: any,
    conversationPublicId: string,
    messagePublicId: string,
    pinned: boolean,
  ) {
    const scope = await this.resolveRequesterScope(requester);
    const conversation = await this.findConversationOrThrow(conversationPublicId);
    await this.assertParticipant(conversation.id, scope);

    const message = await this.messageRepo.findOne({
      where: { publicId: messagePublicId, conversationId: conversation.id },
      relations: ['senderUser', 'reads', 'reactions', 'attachments', 'repliedToMessage', 'repliedToMessage.senderUser', 'repliedToMessage.attachments'],
    });
    if (!message) throw new NotFoundException('Message not found');
    if (message.deletedAt) throw new BadRequestException('Cannot pin a deleted message');

    message.pinnedAt = pinned ? new Date() : null;
    await this.messageRepo.save(message);

    const dto = this.toMessageDto(message, conversation.publicId);
    this.gateway.emitMessageUpdate(conversation.publicId, dto);
    return dto;
  }

  async listPinned(requester: any, conversationPublicId: string) {
    const scope = await this.resolveRequesterScope(requester);
    const conversation = await this.findConversationOrThrow(conversationPublicId);
    await this.assertParticipant(conversation.id, scope);

    const rows = await this.messageRepo.find({
      where: { conversationId: conversation.id, pinnedAt: Not(IsNull()) },
      order: { pinnedAt: 'DESC' },
      relations: ['senderUser', 'reads', 'reactions', 'attachments', 'repliedToMessage', 'repliedToMessage.senderUser', 'repliedToMessage.attachments'],
    });
    return rows.map((m) => this.toMessageDto(m, conversation.publicId));
  }

  async editMessage(requester: any, conversationPublicId: string, messagePublicId: string, body: string) {
    const scope = await this.resolveRequesterScope(requester);
    const conversation = await this.findConversationOrThrow(conversationPublicId);
    await this.assertParticipant(conversation.id, scope);

    const message = await this.messageRepo.findOne({
      where: { publicId: messagePublicId, conversationId: conversation.id },
      relations: ['senderUser', 'reads', 'reactions', 'attachments', 'repliedToMessage', 'repliedToMessage.senderUser', 'repliedToMessage.attachments'],
    });
    if (!message) throw new NotFoundException('Message not found');
    if (message.senderUserId !== scope.userId) throw new ForbiddenException('Cannot edit others messages');
    if (message.deletedAt) throw new BadRequestException('Message was deleted');

    message.body = body;
    message.editedAt = new Date();
    await this.messageRepo.save(message);

    const dto = this.toMessageDto(message, conversation.publicId);
    this.gateway.emitMessageUpdate(conversation.publicId, dto);
    return dto;
  }

  async deleteMessage(requester: any, conversationPublicId: string, messagePublicId: string) {
    const scope = await this.resolveRequesterScope(requester);
    const conversation = await this.findConversationOrThrow(conversationPublicId);
    await this.assertParticipant(conversation.id, scope);

    const message = await this.messageRepo.findOne({
      where: { publicId: messagePublicId, conversationId: conversation.id },
      relations: ['senderUser', 'reads', 'reactions', 'attachments', 'repliedToMessage', 'repliedToMessage.senderUser', 'repliedToMessage.attachments'],
    });
    if (!message) throw new NotFoundException('Message not found');
    if (message.senderUserId !== scope.userId) throw new ForbiddenException('Cannot delete others messages');
    if (message.deletedAt) return this.toMessageDto(message, conversation.publicId);

    message.deletedAt = new Date();
    await this.messageRepo.save(message);

    for (const a of message.attachments || []) {
      const resourceType = a.kind === AttachmentKind.Image ? 'image' : 'raw';
      this.cloudinary.deleteAsset(a.cloudinaryId, resourceType).catch(() => undefined);
    }
    if (message.attachments?.length) {
      await this.attachmentRepo.delete({ messageId: message.id });
    }

    const dto = this.toMessageDto(message, conversation.publicId);
    this.gateway.emitMessageUpdate(conversation.publicId, dto);
    return dto;
  }

  async markRead(requester: any, conversationPublicId: string, upToMessagePublicId: string) {
    const scope = await this.resolveRequesterScope(requester);
    const conversation = await this.findConversationOrThrow(conversationPublicId);
    await this.assertParticipant(conversation.id, scope);

    const cursor = await this.messageRepo.findOne({
      where: { publicId: upToMessagePublicId, conversationId: conversation.id },
    });
    if (!cursor) throw new NotFoundException('Message not found');

    const unread = await this.messageRepo
      .createQueryBuilder('m')
      .leftJoin(
        'chat_message_reads',
        'r',
        'r.message_id = m.id AND r.user_id = :userId',
        { userId: scope.userId },
      )
      .where('m.conversation_id = :cid', { cid: conversation.id })
      .andWhere('m.id <= :cursorId', { cursorId: cursor.id })
      .andWhere('m.sender_user_id != :userId', { userId: scope.userId })
      .andWhere('r.id IS NULL')
      .getMany();

    if (unread.length === 0) return { upToMessagePublicId: cursor.publicId };

    const readAt = new Date();
    await this.readRepo.save(
      unread.map((m) =>
        this.readRepo.create({
          messageId: m.id,
          userId: scope.userId,
          readAt,
        }),
      ),
    );

    this.gateway.emitRead(conversation.publicId, {
      userId: scope.userId,
      upToMessageId: cursor.publicId,
      readAt: readAt.toISOString(),
    });
    this.gateway.emitUnreadChangedToUser(scope.userId, await this.unreadCountForUser(scope));

    return { upToMessagePublicId: cursor.publicId, readCount: unread.length };
  }

  async getUnreadCount(requester: any) {
    const scope = await this.resolveRequesterScope(requester);
    return this.unreadCountForUser(scope);
  }

  async getContacts(requester: any) {
    const scope = await this.resolveRequesterScope(requester);

    const result: Record<string, EntityRef[]> = {
      ADMIN: [],
      PARTNER: [],
      EMPLOYER: [],
      CLIENT: [],
      WORKER: [],
    };

    if (scope.participantType === ParticipantType.Admin) {
      result.PARTNER = await this.allPartners();
      result.EMPLOYER = await this.allEmployers();
      return this.formatContacts(result);
    }

    if (scope.participantType === ParticipantType.Partner) {
      result.ADMIN = await this.adminContact();
      if (this.isHighTierPartner(scope)) {
        result.EMPLOYER = await this.employersOfPartner(scope.participantEntityId);
      }
      return this.formatContacts(result);
    }

    if (scope.participantType === ParticipantType.Employer) {
      result.ADMIN = await this.adminContact();
      const partner = await this.partnerOfEmployer(scope.participantEntityId);
      result.PARTNER = partner ? [partner] : [];
      result.CLIENT = await this.clientsOfEmployer(scope.participantEntityId);
      result.WORKER = await this.workersOfEmployer(scope.participantEntityId);
      const me = await this.employerRepo.findOne({ where: { id: scope.participantEntityId } });
      if (me) {
        result.EMPLOYER = [{ id: me.id, publicId: me.publicId, name: me.name, isSelf: true }];
      }
      return this.formatContacts(result);
    }

    if (scope.participantType === ParticipantType.Client) {
      result.EMPLOYER = await this.employersOfClient(scope.participantEntityId);
      return this.formatContacts(result);
    }

    if (scope.participantType === ParticipantType.Worker) {
      result.EMPLOYER = await this.employersOfWorker(scope.participantEntityId);
      return this.formatContacts(result);
    }

    return this.formatContacts(result);
  }

  async searchMessages(requester: any, q: string, conversationPublicId?: string) {
    const scope = await this.resolveRequesterScope(requester);
    const accessible = await this.findConversationsForScope(scope);
    if (accessible.length === 0) return [];

    let conversationIds = accessible.map((c) => c.id);
    if (conversationPublicId) {
      const target = accessible.find((c) => c.publicId === conversationPublicId);
      if (!target) throw new ForbiddenException('Conversation not accessible');
      conversationIds = [target.id];
    }

    const term = `%${q.replace(/[%_]/g, (m) => `\\${m}`)}%`;
    const messages = await this.messageRepo
      .createQueryBuilder('m')
      .where('m.conversation_id IN (:...ids)', { ids: conversationIds })
      .andWhere('m.deleted_at IS NULL')
      .andWhere('m.body ILIKE :term', { term })
      .orderBy('m.created_at', 'DESC')
      .limit(SEARCH_PAGE_SIZE)
      .getMany();

    const convIndex = new Map(accessible.map((c) => [c.id, c]));
    return messages.map((m) => ({
      messagePublicId: m.publicId,
      conversationPublicId: convIndex.get(m.conversationId)?.publicId,
      body: m.body,
      createdAt: m.createdAt,
      senderUserId: m.senderUserId,
    }));
  }

  private async unreadCountForUser(scope: RequesterScope): Promise<number> {
    const conversations = await this.findConversationsForScope(scope);
    if (conversations.length === 0) return 0;
    const ids = conversations.map((c) => c.id);
    const row = await this.messageRepo
      .createQueryBuilder('m')
      .leftJoin(
        'chat_message_reads',
        'r',
        'r.message_id = m.id AND r.user_id = :userId',
        { userId: scope.userId },
      )
      .where('m.conversation_id IN (:...ids)', { ids })
      .andWhere('m.deleted_at IS NULL')
      .andWhere('m.sender_user_id != :userId', { userId: scope.userId })
      .andWhere('r.id IS NULL')
      .select('COUNT(m.id)', 'count')
      .getRawOne<{ count: string }>();
    return Number(row?.count || 0);
  }

  private async findConversationsForScope(scope: RequesterScope): Promise<Conversation[]> {
    const rows = await this.participantRepo
      .createQueryBuilder('p')
      .innerJoinAndSelect('p.conversation', 'c')
      .where('p.participant_type = :t', { t: scope.participantType })
      .andWhere('p.participant_entity_id = :eid', { eid: scope.participantEntityId })
      .getMany();
    return rows.map((r) => r.conversation);
  }

  private async findConversationOrThrow(publicId: string): Promise<Conversation> {
    const conv = await this.conversationRepo.findOne({ where: { publicId } });
    if (!conv) throw new NotFoundException('Conversation not found');
    return conv;
  }

  private async assertParticipant(conversationId: string, scope: RequesterScope) {
    const row = await this.participantRepo.findOne({
      where: {
        conversationId,
        participantType: scope.participantType,
        participantEntityId: scope.participantEntityId,
      },
    });
    if (!row) throw new ForbiddenException('Not a participant of this conversation');
  }

  private async createConversation(
    createdByUserId: number,
    kind: ConversationKind,
    participants: ParticipantRef[],
  ): Promise<Conversation> {
    return this.dataSource.transaction(async (manager) => {
      const conv = await manager.save(
        manager.create(Conversation, {
          kind,
          createdByUserId,
          lastMessageAt: null,
        }),
      );
      const rows = participants.map((p) =>
        manager.create(ConversationParticipant, {
          conversationId: conv.id,
          participantType: p.type,
          participantEntityId: p.entityId,
        }),
      );
      await manager.save(rows);
      return conv;
    });
  }

  private async findDirectConversation(a: RequesterScope, b: ParticipantRef): Promise<Conversation | null> {
    const conversations = await this.conversationRepo
      .createQueryBuilder('c')
      .innerJoin('chat_conversation_participants', 'pa', 'pa.conversation_id = c.id')
      .innerJoin('chat_conversation_participants', 'pb', 'pb.conversation_id = c.id')
      .where('c.kind = :kind', { kind: ConversationKind.Direct })
      .andWhere('pa.participant_type = :at AND pa.participant_entity_id = :aid', {
        at: a.participantType,
        aid: a.participantEntityId,
      })
      .andWhere('pb.participant_type = :bt AND pb.participant_entity_id = :bid', {
        bt: b.type,
        bid: b.entityId,
      })
      .getMany();

    for (const conv of conversations) {
      const count = await this.participantRepo.count({ where: { conversationId: conv.id } });
      if (count === 2) return conv;
    }
    return null;
  }

  private async findGroupConversation(employerId: number, clientId: number, workerId: number): Promise<Conversation | null> {
    const conversations = await this.conversationRepo
      .createQueryBuilder('c')
      .innerJoin('chat_conversation_participants', 'pe', 'pe.conversation_id = c.id')
      .innerJoin('chat_conversation_participants', 'pc', 'pc.conversation_id = c.id')
      .innerJoin('chat_conversation_participants', 'pw', 'pw.conversation_id = c.id')
      .where('c.kind = :kind', { kind: ConversationKind.Group })
      .andWhere('pe.participant_type = :et AND pe.participant_entity_id = :eid', {
        et: ParticipantType.Employer,
        eid: employerId,
      })
      .andWhere('pc.participant_type = :ct AND pc.participant_entity_id = :cid', {
        ct: ParticipantType.Client,
        cid: clientId,
      })
      .andWhere('pw.participant_type = :wt AND pw.participant_entity_id = :wid', {
        wt: ParticipantType.Worker,
        wid: workerId,
      })
      .getMany();

    for (const conv of conversations) {
      const count = await this.participantRepo.count({ where: { conversationId: conv.id } });
      if (count === 3) return conv;
    }
    return null;
  }

  private async assertCanChatDirect(scope: RequesterScope, target: ParticipantRef): Promise<void> {
    const allowed = (await this.allowedDirectTargets(scope)).some(
      (t) => t.type === target.type && t.entityId === target.entityId,
    );
    if (!allowed) throw new ForbiddenException('Not allowed to chat with this entity');
  }

  private async allowedDirectTargets(scope: RequesterScope): Promise<ParticipantRef[]> {
    switch (scope.participantType) {
      case ParticipantType.Admin: {
        const partners = await this.partnerRepo.find({ select: { id: true } });
        const employers = await this.employerRepo.find({ select: { id: true } });
        return [
          ...partners.map((p) => ({ type: ParticipantType.Partner, entityId: p.id })),
          ...employers.map((e) => ({ type: ParticipantType.Employer, entityId: e.id })),
        ];
      }
      case ParticipantType.Partner: {
        const targets: ParticipantRef[] = [{ type: ParticipantType.Admin, entityId: ADMIN_ENTITY_ID }];
        if (this.isHighTierPartner(scope)) {
          const employers = await this.employerRepo.find({
            where: { partnerId: scope.participantEntityId },
            select: { id: true },
          });
          targets.push(
            ...employers.map((e) => ({ type: ParticipantType.Employer, entityId: e.id })),
          );
        }
        return targets;
      }
      case ParticipantType.Employer: {
        const employer = await this.employerRepo.findOne({ where: { id: scope.participantEntityId } });
        const clients = await this.employerClientRepo
          .createQueryBuilder('ec')
          .innerJoinAndSelect('ec.client', 'client')
          .where('ec.employerId = :eid', { eid: scope.participantEntityId })
          .andWhere('ec.isActive = true')
          .getMany();
        const workers = await this.employerWorkerRepo
          .createQueryBuilder('ew')
          .innerJoinAndSelect('ew.worker', 'worker')
          .where('ew.employerId = :eid', { eid: scope.participantEntityId })
          .andWhere('ew.isActive = true')
          .getMany();
        const out: ParticipantRef[] = [{ type: ParticipantType.Admin, entityId: ADMIN_ENTITY_ID }];
        if (employer?.partnerId) {
          out.push({ type: ParticipantType.Partner, entityId: employer.partnerId });
        }
        out.push(...clients.map((c) => ({ type: ParticipantType.Client, entityId: c.client.id })));
        out.push(...workers.map((w) => ({ type: ParticipantType.Worker, entityId: w.worker.id })));
        return out;
      }
      case ParticipantType.Client: {
        const employers = await this.employerClientRepo
          .createQueryBuilder('ec')
          .innerJoinAndSelect('ec.employer', 'employer')
          .where('ec.clientId = :cid', { cid: scope.participantEntityId })
          .andWhere('ec.isActive = true')
          .getMany();
        return employers.map((e) => ({ type: ParticipantType.Employer, entityId: e.employer.id }));
      }
      case ParticipantType.Worker: {
        const employers = await this.employerWorkerRepo
          .createQueryBuilder('ew')
          .innerJoinAndSelect('ew.employer', 'employer')
          .where('ew.workerId = :wid', { wid: scope.participantEntityId })
          .andWhere('ew.isActive = true')
          .getMany();
        return employers.map((e) => ({ type: ParticipantType.Employer, entityId: e.employer.id }));
      }
    }
  }

  private async assertCanCreateGroup(scope: RequesterScope, employerId: number, clientId: number, workerId: number) {
    const isAdmin = scope.participantType === ParticipantType.Admin;
    const isOwnEmployer =
      scope.participantType === ParticipantType.Employer && scope.participantEntityId === employerId;
    const isHighPartner = this.isHighTierPartner(scope);

    if (!isAdmin && !isOwnEmployer && !isHighPartner) {
      throw new ForbiddenException('Tu plan no permite crear grupos');
    }

    if (isHighPartner) {
      const employer = await this.employerRepo.findOne({ where: { id: employerId } });
      if (!employer || employer.partnerId !== scope.participantEntityId) {
        throw new ForbiddenException('Empleador no pertenece a este partner');
      }
    }

    const hasClient = await this.employerClientRepo.findOne({
      where: { employer: { id: employerId }, client: { id: clientId }, isActive: true },
    });
    if (!hasClient) throw new ForbiddenException('Client is not linked to this employer');
    const hasWorker = await this.employerWorkerRepo.findOne({
      where: { employer: { id: employerId }, worker: { id: workerId }, isActive: true },
    });
    if (!hasWorker) throw new ForbiddenException('Worker is not linked to this employer');
  }

  private async resolveEntityByPublicId(type: ParticipantType, publicId: string): Promise<EntityRef> {
    switch (type) {
      case ParticipantType.Admin:
        return { id: ADMIN_ENTITY_ID, publicId: null, name: 'Admin' };
      case ParticipantType.Partner: {
        const p = await this.partnerRepo.findOne({ where: { publicId } });
        if (!p) throw new NotFoundException('Partner not found');
        return { id: p.id, publicId: p.publicId, name: p.name };
      }
      case ParticipantType.Employer: {
        const e = await this.employerRepo.findOne({ where: { publicId } });
        if (!e) throw new NotFoundException('Employer not found');
        return { id: e.id, publicId: e.publicId, name: e.name };
      }
      case ParticipantType.Client: {
        const c = await this.clientRepo.findOne({ where: { publicId } });
        if (!c) throw new NotFoundException('Client not found');
        return { id: c.id, publicId: c.publicId, name: c.name || c.code };
      }
      case ParticipantType.Worker: {
        const w = await this.workerRepo.findOne({ where: { publicId } });
        if (!w) throw new NotFoundException('Worker not found');
        return { id: w.id, publicId: w.publicId, name: await this.resolveWorkerName(w.id, w.code) };
      }
    }
  }

  private async resolveWorkerName(workerId: number, fallbackCode: string): Promise<string> {
    const link = await this.workerUserRepo.findOne({
      where: { workerId },
      relations: ['user'],
    });
    return link?.user?.name || fallbackCode;
  }

  private async bulkResolveEntityInfo(
    participants: ConversationParticipant[],
  ): Promise<Record<string, { name: string; imageUrl: string | null }>> {
    const partnerIds = new Set<number>();
    const employerIds = new Set<number>();
    const clientIds = new Set<number>();
    const workerIds = new Set<number>();
    for (const p of participants) {
      if (p.participantType === ParticipantType.Partner) partnerIds.add(p.participantEntityId);
      else if (p.participantType === ParticipantType.Employer) employerIds.add(p.participantEntityId);
      else if (p.participantType === ParticipantType.Client) clientIds.add(p.participantEntityId);
      else if (p.participantType === ParticipantType.Worker) workerIds.add(p.participantEntityId);
    }

    const map: Record<string, { name: string; imageUrl: string | null }> = {};
    map[`${ParticipantType.Admin}:${ADMIN_ENTITY_ID}`] = { name: 'Admin', imageUrl: null };

    if (partnerIds.size) {
      const rows = await this.partnerRepo.find({ where: { id: In([...partnerIds]) } });
      for (const r of rows) {
        map[`${ParticipantType.Partner}:${r.id}`] = {
          name: r.name,
          imageUrl: r.logoUrl ?? null,
        };
      }
    }
    if (employerIds.size) {
      const rows = await this.employerRepo.find({ where: { id: In([...employerIds]) } });
      for (const r of rows) {
        // Employers carry a dedicated identity photo. logoUrl is brand
        // artwork for QR-code PDFs only and intentionally not used here.
        map[`${ParticipantType.Employer}:${r.id}`] = {
          name: r.name,
          imageUrl: r.profilePhotoUrl ?? null,
        };
      }
    }
    if (clientIds.size) {
      const rows = await this.clientRepo.find({ where: { id: In([...clientIds]) } });
      for (const r of rows) {
        map[`${ParticipantType.Client}:${r.id}`] = {
          name: r.name || r.code,
          imageUrl: r.logoUrl ?? null,
        };
      }
    }
    if (workerIds.size) {
      const workers = await this.workerRepo.find({ where: { id: In([...workerIds]) } });
      const links = await this.workerUserRepo.find({
        where: { workerId: In(workers.map((w) => w.id)) },
        relations: ['user'],
      });
      const linkMap = new Map<number, string>();
      for (const l of links) {
        if (l.user?.name) linkMap.set(l.workerId, l.user.name);
      }
      for (const w of workers) {
        map[`${ParticipantType.Worker}:${w.id}`] = {
          name: linkMap.get(w.id) || w.code,
          imageUrl: w.logoUrl ?? null,
        };
      }
    }
    return map;
  }

  private async fetchLastMessagesByConversation(conversationIds: string[]): Promise<Record<string, Message>> {
    if (conversationIds.length === 0) return {};
    const rows = await this.messageRepo
      .createQueryBuilder('m')
      .leftJoinAndSelect('m.attachments', 'a')
      .where('m.conversation_id IN (:...ids)', { ids: conversationIds })
      .andWhere(
        `m.id = (SELECT MAX(m2.id) FROM chat_messages m2 WHERE m2.conversation_id = m.conversation_id)`,
      )
      .getMany();
    const out: Record<string, Message> = {};
    for (const r of rows) out[r.conversationId] = r;
    return out;
  }

  private async fetchUnreadCounts(conversationIds: string[], userId: number): Promise<Record<string, number>> {
    if (conversationIds.length === 0) return {};
    const rows = await this.messageRepo
      .createQueryBuilder('m')
      .leftJoin(
        'chat_message_reads',
        'r',
        'r.message_id = m.id AND r.user_id = :userId',
        { userId },
      )
      .select('m.conversation_id', 'cid')
      .addSelect('COUNT(m.id)', 'count')
      .where('m.conversation_id IN (:...ids)', { ids: conversationIds })
      .andWhere('m.deleted_at IS NULL')
      .andWhere('m.sender_user_id != :userId', { userId })
      .andWhere('r.id IS NULL')
      .groupBy('m.conversation_id')
      .getRawMany<{ cid: string; count: string }>();
    const out: Record<string, number> = {};
    for (const r of rows) out[r.cid] = Number(r.count);
    return out;
  }

  private async buildConversationDetail(conv: Conversation, viewerScope: RequesterScope) {
    const participants = await this.participantRepo.find({ where: { conversationId: conv.id } });
    const entityInfoMap = await this.bulkResolveEntityInfo(participants);
    const others = participants.filter(
      (p) =>
        !(p.participantType === viewerScope.participantType &&
          p.participantEntityId === viewerScope.participantEntityId),
    );
    const displayName = others
      .map((p) => entityInfoMap[`${p.participantType}:${p.participantEntityId}`]?.name || 'Sin nombre')
      .join(' · ');
    const displayImageUrl =
      others.length === 1
        ? entityInfoMap[`${others[0].participantType}:${others[0].participantEntityId}`]?.imageUrl ?? null
        : null;

    return {
      publicId: conv.publicId,
      kind: conv.kind,
      displayName,
      displayImageUrl,
      participants: participants.map((p) => {
        const info = entityInfoMap[`${p.participantType}:${p.participantEntityId}`];
        return {
          type: p.participantType,
          entityId: p.participantEntityId,
          name: info?.name || null,
          imageUrl: info?.imageUrl ?? null,
        };
      }),
      lastMessage: null,
      lastMessageAt: conv.lastMessageAt,
      unreadCount: 0,
      createdAt: conv.createdAt,
    };
  }

  private toAttachmentDto(a: MessageAttachment) {
    return {
      publicId: a.publicId,
      kind: a.kind,
      url: a.url,
      mimeType: a.mimeType,
      sizeBytes: a.sizeBytes,
      width: a.width,
      height: a.height,
      originalName: a.originalName,
    };
  }

  private toMessageDto(message: Message, conversationPublicId: string) {
    const repliedTo = message.repliedToMessage
      ? {
          publicId: message.repliedToMessage.publicId,
          senderUserId: message.repliedToMessage.senderUserId,
          senderUserName: message.repliedToMessage.senderUser?.name || null,
          body: message.repliedToMessage.deletedAt ? null : message.repliedToMessage.body,
          deletedAt: message.repliedToMessage.deletedAt,
          attachments: (message.repliedToMessage.attachments || [])
            .sort((x, y) => x.position - y.position)
            .map((a) => this.toAttachmentDto(a)),
        }
      : null;

    const reactionMap = new Map<string, number[]>();
    for (const r of message.reactions || []) {
      const list = reactionMap.get(r.emoji) || [];
      list.push(r.userId);
      reactionMap.set(r.emoji, list);
    }
    const reactions = [...reactionMap.entries()].map(([emoji, userIds]) => ({
      emoji,
      count: userIds.length,
      userIds,
    }));

    const attachments = message.deletedAt
      ? []
      : (message.attachments || [])
          .sort((x, y) => x.position - y.position)
          .map((a) => this.toAttachmentDto(a));

    return {
      publicId: message.publicId,
      conversationPublicId,
      senderUserId: message.senderUserId,
      senderUserName: message.senderUser?.name || null,
      senderEntityType: message.senderEntityType,
      senderEntityId: message.senderEntityId,
      body: message.deletedAt ? null : message.body,
      editedAt: message.editedAt,
      deletedAt: message.deletedAt,
      pinnedAt: message.pinnedAt,
      repliedTo,
      reactions,
      attachments,
      createdAt: message.createdAt,
      readBy: (message.reads || []).map((r) => ({ userId: r.userId, readAt: r.readAt })),
    };
  }

  async setReaction(
    requester: any,
    conversationPublicId: string,
    messagePublicId: string,
    emoji: string,
    action: 'add' | 'remove',
  ) {
    const scope = await this.resolveRequesterScope(requester);
    const conversation = await this.findConversationOrThrow(conversationPublicId);
    await this.assertParticipant(conversation.id, scope);

    const message = await this.messageRepo.findOne({
      where: { publicId: messagePublicId, conversationId: conversation.id },
    });
    if (!message) throw new NotFoundException('Message not found');
    if (message.deletedAt) throw new BadRequestException('Cannot react to a deleted message');

    const cleanEmoji = String(emoji || '').trim();
    if (!cleanEmoji) throw new BadRequestException('Emoji is required');

    if (action === 'add') {
      const existing = await this.reactionRepo.findOne({
        where: { messageId: message.id, userId: scope.userId, emoji: cleanEmoji },
      });
      if (!existing) {
        await this.reactionRepo.save(
          this.reactionRepo.create({
            messageId: message.id,
            userId: scope.userId,
            emoji: cleanEmoji,
          }),
        );
      }
    } else {
      await this.reactionRepo.delete({
        messageId: message.id,
        userId: scope.userId,
        emoji: cleanEmoji,
      });
    }

    const fresh = await this.messageRepo.findOne({
      where: { id: message.id },
      relations: ['senderUser', 'reads', 'reactions', 'attachments', 'repliedToMessage', 'repliedToMessage.senderUser', 'repliedToMessage.attachments'],
    });
    const dto = this.toMessageDto(fresh!, conversation.publicId);
    this.gateway.emitMessageUpdate(conversation.publicId, dto);
    return dto;
  }

  private async notifyConversationUpsert(conversationId: string) {
    const conv = await this.conversationRepo.findOne({ where: { id: conversationId } });
    if (!conv) return;
    const participants = await this.participantRepo.find({ where: { conversationId } });
    const userIds = await this.collectUserIdsForParticipants(participants);
    for (const userId of userIds) {
      this.gateway.emitConversationUpsertToUser(userId, {
        publicId: conv.publicId,
        lastMessageAt: conv.lastMessageAt,
      });
    }
  }

  private async collectUserIdsForParticipants(participants: ConversationParticipant[]): Promise<number[]> {
    const ids = new Set<number>();
    for (const p of participants) {
      const users = await this.usersForParticipant(p.participantType, p.participantEntityId);
      for (const u of users) ids.add(u);
    }
    return [...ids];
  }

  private async usersForParticipant(type: ParticipantType, entityId: number): Promise<number[]> {
    if (type === ParticipantType.Admin) {
      const rows = await this.adminUserRepo.find({ select: { userId: true } });
      return rows.map((r) => r.userId);
    }
    if (type === ParticipantType.Partner) {
      const rows = await this.partnerUserRepo.find({ where: { partnerId: entityId }, select: { userId: true } });
      return rows.map((r) => r.userId);
    }
    if (type === ParticipantType.Employer) {
      const rows = await this.employerUserRepo.find({
        where: { employer: { id: entityId } },
        relations: ['user'],
      });
      return rows.map((r) => r.user.id);
    }
    if (type === ParticipantType.Client) {
      const rows = await this.clientUserRepo.find({ where: { clientId: entityId }, select: { userId: true } });
      return rows.map((r) => r.userId);
    }
    if (type === ParticipantType.Worker) {
      const rows = await this.workerUserRepo.find({ where: { workerId: entityId }, select: { userId: true } });
      return rows.map((r) => r.userId);
    }
    return [];
  }

  private async allPartners(): Promise<EntityRef[]> {
    const rows = await this.partnerRepo.find({ order: { name: 'ASC' } });
    return rows.map((r) => ({
      id: r.id,
      publicId: r.publicId,
      name: r.name,
      imageUrl: r.logoUrl ?? null,
    }));
  }

  private async allEmployers(): Promise<EntityRef[]> {
    const rows = await this.employerRepo.find({ order: { name: 'ASC' } });
    return rows.map((r) => ({
      id: r.id,
      publicId: r.publicId,
      name: r.name,
      imageUrl: r.profilePhotoUrl ?? null,
    }));
  }

  private async adminContact(): Promise<EntityRef[]> {
    return [{ id: ADMIN_ENTITY_ID, publicId: null, name: 'Admin', imageUrl: null }];
  }

  private async employersOfPartner(partnerId: number): Promise<EntityRef[]> {
    const rows = await this.employerRepo.find({ where: { partnerId }, order: { name: 'ASC' } });
    return rows.map((r) => ({
      id: r.id,
      publicId: r.publicId,
      name: r.name,
      imageUrl: r.profilePhotoUrl ?? null,
    }));
  }

  private async partnerOfEmployer(employerId: number): Promise<EntityRef | null> {
    const employer = await this.employerRepo.findOne({ where: { id: employerId } });
    if (!employer?.partnerId) return null;
    const partner = await this.partnerRepo.findOne({ where: { id: employer.partnerId } });
    return partner
      ? {
          id: partner.id,
          publicId: partner.publicId,
          name: partner.name,
          imageUrl: partner.logoUrl ?? null,
        }
      : null;
  }

  private async clientsOfEmployer(employerId: number): Promise<EntityRef[]> {
    const rows = await this.employerClientRepo
      .createQueryBuilder('ec')
      .innerJoinAndSelect('ec.client', 'client')
      .where('ec.employerId = :eid', { eid: employerId })
      .andWhere('ec.isActive = true')
      .orderBy('client.name', 'ASC')
      .getMany();
    return rows.map((r) => ({
      id: r.client.id,
      publicId: r.client.publicId,
      name: r.client.name || r.client.code,
      imageUrl: r.client.logoUrl ?? null,
    }));
  }

  private async workersOfEmployer(employerId: number): Promise<EntityRef[]> {
    const rows = await this.employerWorkerRepo
      .createQueryBuilder('ew')
      .innerJoinAndSelect('ew.worker', 'worker')
      .where('ew.employerId = :eid', { eid: employerId })
      .andWhere('ew.isActive = true')
      .getMany();
    const out: EntityRef[] = [];
    for (const row of rows) {
      const name = await this.resolveWorkerName(row.worker.id, row.worker.code);
      out.push({
        id: row.worker.id,
        publicId: row.worker.publicId,
        name,
        imageUrl: row.worker.logoUrl ?? null,
      });
    }
    out.sort((a, b) => a.name.localeCompare(b.name));
    return out;
  }

  private async employersOfClient(clientId: number): Promise<EntityRef[]> {
    const rows = await this.employerClientRepo
      .createQueryBuilder('ec')
      .innerJoinAndSelect('ec.employer', 'employer')
      .where('ec.clientId = :cid', { cid: clientId })
      .andWhere('ec.isActive = true')
      .orderBy('employer.name', 'ASC')
      .getMany();
    return rows.map((r) => ({
      id: r.employer.id,
      publicId: r.employer.publicId,
      name: r.employer.name,
      imageUrl: r.employer.profilePhotoUrl ?? null,
    }));
  }

  private async employersOfWorker(workerId: number): Promise<EntityRef[]> {
    const rows = await this.employerWorkerRepo
      .createQueryBuilder('ew')
      .innerJoinAndSelect('ew.employer', 'employer')
      .where('ew.workerId = :wid', { wid: workerId })
      .andWhere('ew.isActive = true')
      .orderBy('employer.name', 'ASC')
      .getMany();
    return rows.map((r) => ({
      id: r.employer.id,
      publicId: r.employer.publicId,
      name: r.employer.name,
      imageUrl: r.employer.profilePhotoUrl ?? null,
    }));
  }

  private formatContacts(grouped: Record<string, EntityRef[]>) {
    return Object.entries(grouped)
      .filter(([, list]) => list.length > 0)
      .map(([type, items]) => ({ type, items }));
  }
}
