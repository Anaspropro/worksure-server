import { Module } from '@nestjs/common';
import { PrismaModule } from '../../database/prisma.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { QueueModule } from '../queue/queue.module';
import { AuditEventListener } from './listeners/audit-event.listener';

@Module({
  imports: [PrismaModule, NotificationsModule, QueueModule],
  providers: [AuditEventListener],
})
export class EventsModule {}
