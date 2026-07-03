import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { Worker, Job } from 'bullmq';
import { redisConnection } from '../../queue/redis';
import { EmailService } from '../../common/services/email.service';
import { EmailJobData } from '../../queue/queue';

@Injectable()
export class QueueService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(QueueService.name);
  private emailWorker: Worker;

  constructor(private readonly emailService: EmailService) {}

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
    });
    
    this.emailWorker.on('error', (err) => {
      this.logger.error(`Worker error: ${err.message}`);
    });

    this.logger.log('🚀 QueueService Email Worker started.');
  }

  async onModuleDestroy() {
    this.logger.log('Shutting down QueueService Email Worker...');
    await this.emailWorker?.close();
  }
}
