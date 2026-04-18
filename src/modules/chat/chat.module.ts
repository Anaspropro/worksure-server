import { Module, forwardRef } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PrismaService } from '../../database/prisma.service';
import { AuthModule } from '../auth/auth.module';
import { ChatController } from './chat.controller';
import { ChatGateway } from './chat.gateway';
import { ChatService } from './chat.service';
import { MediaService } from './media.service';
import { UploadController } from './upload.controller';

@Module({
  imports: [
    forwardRef(() => AuthModule),
    JwtModule.register({
      secret: process.env.JWT_SECRET || 'development-secret',
    }),
  ],
  controllers: [ChatController, UploadController],
  providers: [PrismaService, ChatService, MediaService, ChatGateway],
  exports: [ChatService, ChatGateway],
})
export class ChatModule {}
