import { Module, forwardRef } from '@nestjs/common';
import { PrismaModule } from '../../database/prisma.module';
import { NotificationsService } from './notifications.service';
import { NotificationsController } from './notifications.controller';
import { AuthModule } from '../auth/auth.module';
import { NotificationsGateway } from './notifications.gateway';
import { NotificationTemplateService } from './notification-template.service';
import { DiscordWebhookService } from './discord-webhook.service';

@Module({
  imports: [PrismaModule, forwardRef(() => AuthModule)],
  controllers: [NotificationsController],
  providers: [
    NotificationsService,
    NotificationsGateway,
    NotificationTemplateService,
    DiscordWebhookService,
  ],
  exports: [
    NotificationsService,
    NotificationsGateway,
    NotificationTemplateService,
    DiscordWebhookService,
  ],
})
export class NotificationsModule {}
