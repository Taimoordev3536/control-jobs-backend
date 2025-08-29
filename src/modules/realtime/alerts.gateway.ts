import { WebSocketGateway, WebSocketServer, OnGatewayConnection, OnGatewayDisconnect } from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';

@Injectable()
@WebSocketGateway({
  cors: { origin: '*', credentials: false },
})
export class AlertsGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer() server: Server;

  constructor(private readonly jwtService: JwtService) {}

  async handleConnection(socket: Socket) {
    try {
      const tokenHeader = socket.handshake.headers['authorization'];
      const tokenFromHeader = typeof tokenHeader === 'string' && tokenHeader.startsWith('Bearer ')
        ? tokenHeader.slice(7)
        : undefined;
      const token = (socket.handshake.auth as any)?.token || tokenFromHeader;
      if (!token) {
        console.warn('[WS] Missing token in handshake, disconnecting');
        socket.disconnect(true);
        return;
      }
      const payload: any = this.jwtService.verify(token);
      const rawRole = payload?.role?.name || payload?.role;
      const role = typeof rawRole === 'string' ? rawRole.toUpperCase() : rawRole;
      const userId = payload?.id;
      if (!role || !userId) {
        console.warn('[WS] Invalid payload, missing role or id');
        socket.disconnect(true);
        return;
      }

      // Always join a user-scoped room
      socket.join(`user:${userId}`);
      if (role === 'EMPLOYER') socket.join(`employer:${userId}`);
      if (role === 'CLIENT') socket.join(`client:${userId}`);
      if (role === 'WORKER') socket.join(`worker:${userId}`);
      console.log(`[WS] Connected user ${userId} role ${role}`);
    } catch (e) {
      console.error('[WS] Handshake error', e?.message || e);
      socket.disconnect(true);
    }
  }

  handleDisconnect() {}

  emitAlertToEmployer(employerUserId: number, data: any) {
    this.server.to(`employer:${employerUserId}`).emit('alerts:new', data);
  }

  emitAlertToClient(clientUserId: number, data: any) {
    this.server.to(`client:${clientUserId}`).emit('alerts:new', data);
  }

  emitAlertToWorker(workerUserId: number, data: any) {
    this.server.to(`worker:${workerUserId}`).emit('alerts:new', data);
  }

  emitAlertToUser(userId: number, data: any) {
    this.server.to(`user:${userId}`).emit('alerts:new', data);
  }
}


