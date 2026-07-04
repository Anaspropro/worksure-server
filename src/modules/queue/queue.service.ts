import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { Worker, Job } from 'bullmq';
import { redisConnection } from '../../queue/redis';
import { EmailService } from '../../common/services/email.service';
import { AlertingService } from '../monitoring/alerting.service';
import { EmailJobData } from '../../queue/queue';

@Injectable()
export class QueueService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(QueueService.name);
  private emailWorker: Worker;

  constructor(
    private readonly emailService: EmailService,
    private readonly alertingService: AlertingService
  ) {}

  onModuleInit() {
    this.emailWorker = new Worker<EmailJobData, any, string>(
      'email-queue',
      async (job: Job<EmailJobData>) => {
        const { to, name, token } = job.data as any; // Allow token for custom jobs
        
        if (!to) {
          throw new Error(`Job ${job.id} missing required 'to' data`);
        }

        this.logger.log(`⚙️ Processing email job ${job.id} (Type: ${job.name}) to ${to}`);
        
        switch (job.name) {
          case 'sendVerificationOtp':
            if (!token) throw new Error('Missing OTP token');
            await this.emailService.sendVerificationOtp(to, token);
            break;
          case 'sendPasswordReset':
            if (!token) throw new Error('Missing reset token');
            await this.emailService.sendPasswordReset(to, token);
            break;
          default:
            this.logger.warn(`Unknown email job type: ${job.name}`);
        }
        
        return { success: true, deliveredTo: to, timestamp: new Date().toISOString() };
      },
      {
        connection: redisConnection as any,
        limiter: {
          max: 5,
          duration: 10000,
        },
        concurrency: 5,
      }
    );

    this.emailWorker.on('failed', (job, err) => {
      this.logger.error(`❌ Job ${job?.id} FAILED with error: ${err.message}`);
      // Not sending critical alert here because failures could be transient.
      // But we will log them. For critical issues, see 'error' or 'stalled'.
    });
    
    this.emailWorker.on('error', (err) => {
      this.logger.error(`Worker error: ${err.message}`);
      this.alertingService.sendCriticalAlert(
        'bullmq_worker_error',
        'BullMQ Worker Error',
        `A critical error occurred in the BullMQ worker: ${err.message}`,
        { error: err.stack }
      ).catch(() => {});
    });

    this.emailWorker.on('stalled', (jobId) => {
      this.logger.warn(`Job ${jobId} has stalled`);
      this.alertingService.sendCriticalAlert(
        'bullmq_stalled_worker',
        'BullMQ Stalled Worker',
        `Job ${jobId} has stalled in the email queue.`
      ).catch(() => {});
    });

    this.logger.log('🚀 QueueService Email Worker started.');
  }

  async onModuleDestroy() {
    this.logger.log('Shutting down QueueService Email Worker...');
    await this.emailWorker?.close();
  }
}
