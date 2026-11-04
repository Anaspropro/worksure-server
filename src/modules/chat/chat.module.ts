import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AppConfigModule } from '../../config/app-config.module';
import { AppConfigService } from '../../config/app-config.service';
import { AuthModule } from '../auth/auth.module';
import { ChatController } from './chat.controller';
import { ChatGateway } from './chat.gateway';
import { ChatService } from './chat.service';
import { MediaService } from './media.service';
import { UploadController } from './upload.controller';

@Module({
  imports: [
    AuthModule,
    AppConfigModule,
    JwtModule.registerAsync({
      imports: [AppConfigModule],
      inject: [AppConfigService],
      useFactory: (appConfigService: AppConfigService) => ({
        secret: appConfigService.jwtSecret,
      }),
    }),
  ],
  controllers: [ChatController, UploadController],
  providers: [ChatService, MediaService, ChatGateway],
  exports: [ChatService, ChatGateway],
})
export class ChatModule {}
