import { Module, forwardRef } from '@nestjs/common';
import { PrismaModule } from '../../database/prisma.module';
import { NotificationsService } from './notifications.service';
import { NotificationsController } from './notifications.controller';
import { AuthModule } from '../auth/auth.module';
import { NotificationsGateway } from './notifications.gateway';
import { NotificationTemplateService } from './notification-template.service';

@Module({
  imports: [PrismaModule, forwardRef(() => AuthModule)],
  controllers: [NotificationsController],
  providers: [NotificationsService, NotificationsGateway, NotificationTemplateService],
  exports: [NotificationsService, NotificationsGateway, NotificationTemplateService],
})
export class NotificationsModule {}
