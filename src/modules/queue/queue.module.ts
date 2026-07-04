import { Module } from '@nestjs/common';
import { QueueService } from './queue.service';
import { EmailService } from '../../common/services/email.service';
import { AppConfigModule } from '../../config/app-config.module';

import { MonitoringModule } from '../monitoring/monitoring.module';

@Module({
  imports: [AppConfigModule, MonitoringModule],
  providers: [QueueService, EmailService],
  exports: [QueueService],
})
export class QueueModule {}
