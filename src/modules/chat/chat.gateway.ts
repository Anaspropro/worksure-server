import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import {
  ForbiddenException,
  Inject,
  Injectable,
  UnauthorizedException,
  UsePipes,
  ValidationPipe,
  forwardRef,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Server, Socket } from 'socket.io';
import { ChatService } from './chat.service';
import { JoinConversationDto } from './dto/join-conversation.dto';
import { SendSocketMessageDto } from './dto/send-socket-message.dto';

type ChatSocketUser = {
  id: string;
  email: string;
  role: string;
};

type ChatSocket = Socket & {
  user?: ChatSocketUser;
};

@Injectable()
@WebSocketGateway({
  namespace: '/chat',
  cors: {
    origin: process.env.ALLOWED_ORIGINS?.split(','),
    credentials: true,
  },
})
export class ChatGateway
  implements OnGatewayConnection<ChatSocket>, OnGatewayDisconnect<ChatSocket>
{
  @WebSocketServer()
  server!: Server;

  constructor(
    @Inject(forwardRef(() => ChatService))
    private readonly chatService: ChatService,
    private readonly jwtService: JwtService,
  ) {}

  async handleConnection(client: ChatSocket) {
    const token =
      typeof client.handshake.auth?.token === 'string'
        ? client.handshake.auth.token
        : undefined;

    if (!token) {
      client.disconnect();
      return;
    }

    try {
      const payload = await this.jwtService.verifyAsync<{
        sub: string;
        email: string;
        role: string;
        purpose?: string;
      }>(token);

      if (payload.purpose !== 'chat_socket') {
        throw new UnauthorizedException('Invalid socket token.');
      }

      client.user = {
        id: payload.sub,
        email: payload.email,
        role: payload.role,
      };
      await client.join(this.getUserRoom(payload.sub));
    } catch {
      client.disconnect();
    }
  }

  async handleDisconnect(client: ChatSocket) {
    if (client.user) {
      await client.leave(this.getUserRoom(client.user.id));
    }
  }

  @UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
  @SubscribeMessage('joinConversation')
  async joinConversation(
    @ConnectedSocket() client: ChatSocket,
    @MessageBody() payload: JoinConversationDto,
  ) {
    if (!client.user) {
      throw new UnauthorizedException('Authentication required.');
    }

    const conversation = await this.chatService.ensureParticipant(
      payload.conversationId,
      client.user.id,
    );

    if (!conversation) {
      throw new ForbiddenException('Conversation access denied.');
    }

    await client.join(this.getConversationRoom(payload.conversationId));
    return { joined: true, conversationId: payload.conversationId };
  }

  @SubscribeMessage('leaveConversation')
  async leaveConversation(
    @ConnectedSocket() client: ChatSocket,
    @MessageBody() payload: JoinConversationDto,
  ) {
    await client.leave(this.getConversationRoom(payload.conversationId));
    return { left: true, conversationId: payload.conversationId };
  }

  @UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
  @SubscribeMessage('sendMessage')
  async handleMessage(
    @ConnectedSocket() client: ChatSocket,
    @MessageBody() payload: SendSocketMessageDto,
  ) {
    if (!client.user) {
      throw new UnauthorizedException('Authentication required.');
    }

    const message = await this.chatService.createMessageFromUpload(
      {
        conversationId: payload.conversationId,
        content: payload.content,
        type: payload.type,
        fileUrl: payload.fileUrl,
        fileType: payload.fileType,
        fileName: payload.fileName,
        fileSize: payload.fileSize,
      },
      client.user.id,
    );

    return message;
  }

  emitMessageCreated(conversationId: string, message: unknown) {
    this.server
      .to(this.getConversationRoom(conversationId))
      .emit('newMessage', message);
  }

  private getConversationRoom(conversationId: string) {
    return `conversation:${conversationId}`;
  }

  private getUserRoom(userId: string) {
    return `user:${userId}`;
  }
}
