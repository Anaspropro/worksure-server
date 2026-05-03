import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';

@WebSocketGateway({
  namespace: 'notifications',
  cors: {
    origin: '*',
  },
})
export class NotificationsGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  constructor(private readonly jwtService: JwtService) {}

  private readonly logger = new Logger(NotificationsGateway.name);

  async handleConnection(client: Socket) {
    const token = client.handshake.auth?.token;

    if (!token) {
      this.logger.warn(`Client ${client.id} connected without token`);
      return;
    }

    try {
      const payload = await this.jwtService.verifyAsync(token);
      client.join(`user:${payload.sub}`);
      this.logger.log(`User ${payload.sub} authenticated and joined room`);
    } catch (err) {
      this.logger.error(`Auth failed for client ${client.id}: ${err.message}`);
      client.disconnect();
    }
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected from notifications: ${client.id}`);
  }

  emitToUser(userId: string, event: string, data: any) {
    this.server.to(`user:${userId}`).emit(event, data);
  }
}
