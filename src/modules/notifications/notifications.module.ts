import { Module, forwardRef } from '@nestjs/common';
import { PrismaModule } from '../../database/prisma.module';
import { NotificationsService } from './notifications.service';
import { NotificationsController } from './notifications.controller';
import { AuthModule } from '../auth/auth.module';
import { NotificationsGateway } from './notifications.gateway';
import { NotificationTemplateService } from './notification-template.service';
import { DiscordWebhookService } from './discord-webhook.service';
import { BullModule } from '@nestjs/bullmq';
import { NotificationsListener } from './notifications.listener';
import { NotificationRoutingProcessor } from './processors/notification-routing.processor';
import { InAppDeliveryProcessor } from './processors/in-app-delivery.processor';
import { EmailDeliveryProcessor } from './processors/email-delivery.processor';
import { EmailService } from '../../common/services/email.service';

@Module({
  imports: [
    PrismaModule, 
    forwardRef(() => AuthModule),
    BullModule.registerQueue({
      name: 'notification-routing-queue',
    }),
    BullModule.registerQueue({
      name: 'email-delivery-queue',
    }),
    BullModule.registerQueue({
      name: 'in-app-delivery-queue',
    }),
  ],
  controllers: [NotificationsController],
  providers: [
    NotificationsService,
    NotificationsGateway,
    NotificationTemplateService,
    DiscordWebhookService,
    NotificationsListener,
    NotificationRoutingProcessor,
    InAppDeliveryProcessor,
    EmailDeliveryProcessor,
    EmailService,
  ],
  exports: [
    NotificationsService,
    NotificationsGateway,
    NotificationTemplateService,
    DiscordWebhookService,
    BullModule,
  ],
})
export class NotificationsModule {}
