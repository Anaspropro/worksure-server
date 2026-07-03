import { Module } from '@nestjs/common';
import { QueueService } from './queue.service';
import { EmailService } from '../../common/services/email.service';
import { AppConfigModule } from '../../config/app-config.module';

@Module({
  imports: [AppConfigModule],
  providers: [QueueService, EmailService],
  exports: [QueueService],
})
export class QueueModule {}
