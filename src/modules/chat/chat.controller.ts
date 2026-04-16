import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiConsumes,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../auth/auth.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { GetMessagesQueryDto } from './dto/get-messages-query.dto';
import { SendMessageDto } from './dto/send-message.dto';
import { ChatService } from './chat.service';

@ApiTags('chat')
@Controller('chat')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  @Get('conversations')
  @ApiOperation({ summary: 'List conversations available to the current user' })
  async getConversations(@CurrentUser() user: AuthenticatedUser) {
    const conversations = await this.chatService.getUserConversations(user.id);
    return { data: conversations };
  }

  @Post('socket-token')
  @ApiOperation({ summary: 'Issue a short-lived socket token for chat' })
  async createSocketToken(@CurrentUser() user: AuthenticatedUser) {
    const token = await this.chatService.issueSocketToken(user);
    return { data: { token } };
  }

  @Post('contracts/:contractId/conversation')
  @ApiOperation({ summary: 'Get or create the contract conversation' })
  async getOrCreateConversation(
    @Param('contractId') contractId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const conversation =
      await this.chatService.getOrCreateConversationByContract(
        contractId,
        user.id,
      );
    return { data: conversation };
  }

  @Get('conversations/:conversationId/messages')
  @ApiOperation({ summary: 'Get messages for a conversation' })
  async getMessages(
    @Param('conversationId') conversationId: string,
    @Query() query: GetMessagesQueryDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.chatService.getMessages(
      conversationId,
      user.id,
      query.cursor,
      query.limit,
    );
  }

  @Post('conversations/:conversationId/messages')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: {
        fileSize: 10 * 1024 * 1024,
      },
    }),
  )
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Create a new chat message, optionally with media' })
  @ApiResponse({ status: 201, description: 'Message created successfully' })
  async createMessage(
    @Param('conversationId') conversationId: string,
    @Body() body: Omit<SendMessageDto, 'conversationId'>,
    @CurrentUser() user: AuthenticatedUser,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    const message = body.fileUrl
      ? await this.chatService.createMessageFromUpload(
          {
            conversationId,
            content: body.content,
            type: body.type,
            fileUrl: body.fileUrl,
            fileType: body.fileType,
            fileName: body.fileName,
            fileSize: body.fileSize,
          },
          user.id,
        )
      : await this.chatService.createMessage(
          {
            conversationId,
            content: body.content,
            type: body.type,
          },
          user.id,
          file,
        );

    return {
      message: 'Message sent successfully',
      data: message,
    };
  }
}
