import { Injectable, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { User } from '../../users/entities/user.entity';

interface ChatTokenPayload {
  id: number;
  name?: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  role?: any;
}

@Injectable()
@WebSocketGateway({ cors: { origin: '*', credentials: false } })
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  private readonly logger = new Logger(ChatGateway.name);

  @WebSocketServer()
  server: Server;

  constructor(
    private readonly jwtService: JwtService,
    @InjectRepository(User) private readonly userRepo: Repository<User>,
  ) {}

  async handleConnection(socket: Socket) {
    try {
      const token = this.extractToken(socket);
      if (!token) {
        socket.disconnect(true);
        return;
      }
      const payload = this.jwtService.verify<ChatTokenPayload>(token);
      if (!payload?.id) {
        socket.disconnect(true);
        return;
      }
      socket.data.userId = payload.id;
      socket.data.userName = await this.resolveDisplayName(payload);
      socket.join(this.userRoom(payload.id));
    } catch (err) {
      this.logger.warn(`Handshake rejected: ${(err as Error).message}`);
      socket.disconnect(true);
    }
  }

  handleDisconnect() {}

  @SubscribeMessage('chat:subscribe')
  onSubscribe(
    @ConnectedSocket() socket: Socket,
    @MessageBody() body: { conversationPublicId: string },
  ) {
    if (!body?.conversationPublicId) return;
    socket.join(this.conversationRoom(body.conversationPublicId));
  }

  @SubscribeMessage('chat:unsubscribe')
  onUnsubscribe(
    @ConnectedSocket() socket: Socket,
    @MessageBody() body: { conversationPublicId: string },
  ) {
    if (!body?.conversationPublicId) return;
    socket.leave(this.conversationRoom(body.conversationPublicId));
  }

  @SubscribeMessage('chat:typing')
  onTyping(
    @ConnectedSocket() socket: Socket,
    @MessageBody() body: { conversationPublicId: string },
  ) {
    if (!body?.conversationPublicId) return;
    socket.to(this.conversationRoom(body.conversationPublicId)).emit('chat:typing', {
      conversationPublicId: body.conversationPublicId,
      userId: socket.data.userId,
      userName: socket.data.userName,
    });
  }

  emitMessageNew(conversationPublicId: string, message: any) {
    this.server.to(this.conversationRoom(conversationPublicId)).emit('chat:message:new', message);
  }

  emitMessageUpdate(conversationPublicId: string, message: any) {
    this.server.to(this.conversationRoom(conversationPublicId)).emit('chat:message:update', message);
  }

  emitRead(conversationPublicId: string, payload: { userId: number; upToMessageId: string; readAt: string }) {
    this.server.to(this.conversationRoom(conversationPublicId)).emit('chat:read', {
      conversationPublicId,
      ...payload,
    });
  }

  emitConversationUpsertToUser(userId: number, conversation: any) {
    this.server.to(this.userRoom(userId)).emit('chat:conversation:upsert', conversation);
  }

  emitUnreadChangedToUser(userId: number, unreadCount: number) {
    this.server.to(this.userRoom(userId)).emit('chat:unread:changed', { unreadCount });
  }

  private async resolveDisplayName(payload: ChatTokenPayload): Promise<string | null> {
    if (payload.name) return payload.name;
    const user = await this.userRepo.findOne({
      where: { id: payload.id },
      select: { id: true, name: true, firstName: true, lastName: true },
    });
    if (user?.name) return user.name;
    const full = [user?.firstName, user?.lastName].filter(Boolean).join(' ').trim();
    if (full) return full;
    return null;
  }

  private extractToken(socket: Socket): string | undefined {
    const tokenFromHeader = socket.handshake.headers['authorization'];
    const bearer =
      typeof tokenFromHeader === 'string' && tokenFromHeader.startsWith('Bearer ')
        ? tokenFromHeader.slice(7)
        : undefined;
    return (socket.handshake.auth as any)?.token || bearer;
  }

  private userRoom(userId: number): string {
    return `chat:user:${userId}`;
  }

  private conversationRoom(publicId: string): string {
    return `chat:conversation:${publicId}`;
  }
}
