/* eslint-disable @typescript-eslint/no-unsafe-argument */
import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  forwardRef,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../../database/prisma.service';
import {
  MessageType as MessageTypeEnum,
  type MessageType,
} from '../../generated/prisma';
import { ChatGateway } from './chat.gateway';
import { MediaService } from './media.service';
import { SendMessageDto } from './dto/send-message.dto';
import { SendSocketMessageDto } from './dto/send-socket-message.dto';

type UploadedAttachment = {
  fileUrl: string;
  fileType?: string | null;
  fileName?: string | null;
  fileSize?: number | null;
};

@Injectable()
export class ChatService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mediaService: MediaService,
    private readonly jwtService: JwtService,
    @Inject(forwardRef(() => ChatGateway))
    private readonly chatGateway: ChatGateway,
  ) {}

  async issueSocketToken(user: { id: string; email: string; role: string }) {
    return this.jwtService.signAsync(
      {
        sub: user.id,
        email: user.email,
        role: user.role,
        purpose: 'chat_socket',
      },
      { expiresIn: '10m' },
    );
  }

  async getOrCreateConversationByContract(contractId: string, userId: string) {
    const contract = await this.prisma.contract.findUnique({
      where: { id: contractId },
      include: {
        job: true,
      },
    });

    if (!contract) {
      throw new NotFoundException('Contract not found.');
    }

    if (contract.clientId !== userId && contract.artisanId !== userId) {
      throw new ForbiddenException(
        'Only contract parties can access chat conversations.',
      );
    }

    const conversation = await this.prisma.conversation.upsert({
      where: { contractId },
      update: {},
      create: {
        id: randomUUID(),
        contractId,
        clientId: contract.clientId,
        artisanId: contract.artisanId,
      },
      include: {
        contract: {
          include: {
            job: true,
            client: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
            artisan: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
          },
        },
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    });

    return this.serializeConversation(conversation);
  }

  async getUserConversations(userId: string) {
    const conversations = await this.prisma.conversation.findMany({
      where: {
        OR: [{ clientId: userId }, { artisanId: userId }],
      },
      include: {
        contract: {
          include: {
            job: true,
            client: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
            artisan: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
          },
        },
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
      orderBy: {
        updatedAt: 'desc',
      },
    });

    return conversations.map((conversation) =>
      this.serializeConversation(conversation),
    );
  }

  async ensureParticipant(conversationId: string, userId: string) {
    const conversation = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
    });

    if (!conversation) {
      throw new NotFoundException('Conversation not found.');
    }

    if (conversation.clientId !== userId && conversation.artisanId !== userId) {
      throw new ForbiddenException('Conversation access denied.');
    }

    return conversation;
  }

  async getMessages(
    conversationId: string,
    userId: string,
    cursor?: string,
    limit = 30,
  ) {
    await this.ensureParticipant(conversationId, userId);

    const messages = await this.prisma.message.findMany({
      where: { conversationId },
      include: {
        conversation: {
          include: {
            contract: {
              include: {
                job: true,
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: limit + 1,
      ...(cursor
        ? {
            skip: 1,
            cursor: { id: cursor },
          }
        : {}),
    });

    const hasMore = messages.length > limit;
    const sliced = hasMore ? messages.slice(0, limit) : messages;

    return {
      data: sliced.reverse().map((message) => this.serializeMessage(message)),
      meta: {
        nextCursor: hasMore ? sliced[sliced.length - 1]?.id : null,
        hasMore,
      },
    };
  }

  async createMessage(
    dto: SendMessageDto,
    senderId: string,
    file?: Express.Multer.File,
  ) {
    const conversation = await this.ensureParticipant(
      dto.conversationId,
      senderId,
    );
    const messageType = this.resolveMessageType(dto.type, file);

    let upload: UploadedAttachment | undefined;

    if (file) {
      const result = await this.mediaService.uploadFile(file);
      upload = {
        fileUrl: result.secure_url,
        fileType: file.mimetype || null,
        fileName: file.originalname || null,
        fileSize: file.size ?? null,
      };
    }

    return this.persistMessage(conversation.id, senderId, {
      content: dto.content,
      type: messageType,
      upload,
    });
  }

  async createMessageFromUpload(
    payload: Omit<SendSocketMessageDto, 'conversationId'> & {
      conversationId: string;
    },
    senderId: string,
  ) {
    const conversation = await this.ensureParticipant(
      payload.conversationId,
      senderId,
    );

    return this.persistMessage(conversation.id, senderId, {
      content: payload.content,
      type: this.resolveMessageType(payload.type, payload.fileUrl),
      upload: payload.fileUrl
        ? {
            fileUrl: payload.fileUrl,
            fileType: payload.fileType ?? null,
            fileName: payload.fileName ?? null,
            fileSize: payload.fileSize ?? null,
          }
        : undefined,
    });
  }

  private resolveMessageType(
    inputType?: MessageType,
    file?: Express.Multer.File | string,
  ): MessageType {
    if (!file) {
      return inputType ?? MessageTypeEnum.TEXT;
    }

    if (typeof file === 'string') {
      return inputType ?? MessageTypeEnum.FILE;
    }

    if (file.mimetype.startsWith('image/')) {
      return MessageTypeEnum.IMAGE;
    }

    if (file.mimetype.startsWith('video/')) {
      return MessageTypeEnum.VIDEO;
    }

    if (file.mimetype.startsWith('audio/')) {
      return MessageTypeEnum.AUDIO;
    }

    return MessageTypeEnum.FILE;
  }

  private async persistMessage(
    conversationId: string,
    senderId: string,
    input: {
      content?: string;
      type: MessageType;
      upload?: UploadedAttachment;
    },
  ) {
    const trimmedContent = input.content?.trim() || null;

    if (!trimmedContent && !input.upload) {
      throw new BadRequestException(
        'A message must include text or a supported attachment.',
      );
    }

    if (input.type === MessageTypeEnum.TEXT && !trimmedContent) {
      throw new BadRequestException('Text messages require content.');
    }

    const message = await this.prisma.$transaction(async (tx) => {
      const created = await tx.message.create({
        data: {
          id: randomUUID(),
          conversationId,
          senderId,
          content: trimmedContent,
          type: input.type,
          fileUrl: input.upload?.fileUrl,
          fileType: input.upload?.fileType,
          fileName: input.upload?.fileName,
          fileSize: input.upload?.fileSize,
        },
        include: {
          conversation: {
            include: {
              contract: {
                include: {
                  job: true,
                },
              },
            },
          },
        },
      });

      await tx.conversation.update({
        where: { id: conversationId },
        data: {
          updatedAt: new Date(),
        },
      });

      return created;
    });

    const serialized = this.serializeMessage(message);
    this.chatGateway.emitMessageCreated(conversationId, serialized);
    return serialized;
  }

  private serializeConversation(conversation: any) {
    return {
      id: conversation.id,
      contractId: conversation.contractId,
      clientId: conversation.clientId,
      artisanId: conversation.artisanId,
      createdAt: conversation.createdAt.toISOString(),
      updatedAt: conversation.updatedAt.toISOString(),
      contract: conversation.contract
        ? {
            id: conversation.contract.id,
            status: conversation.contract.status,
            amount: conversation.contract.amount,
            job: conversation.contract.job,
            client: conversation.contract.client,
            artisan: conversation.contract.artisan,
          }
        : undefined,
      lastMessage: conversation.messages?.[0]
        ? this.serializeMessage(conversation.messages[0])
        : null,
    };
  }

  private serializeMessage(message: any) {
    return {
      id: message.id,
      conversationId: message.conversationId,
      senderId: message.senderId,
      content: message.content,
      type: message.type,
      fileUrl: message.fileUrl,
      fileType: message.fileType,
      fileName: message.fileName,
      fileSize: message.fileSize,
      createdAt: message.createdAt.toISOString(),
      contractId: message.conversation?.contractId ?? undefined,
      jobTitle: message.conversation?.contract?.job?.title ?? undefined,
    };
  }
}
