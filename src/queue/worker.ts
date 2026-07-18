import { Worker, Job } from 'bullmq';
import { redisConnection } from './redis';
import { EmailJobData } from './queue';

/**
 * BullMQ Worker instance for 'email-queue'
 */
export const emailWorker = new Worker<EmailJobData, any, string>(
  'email-queue',
  async (job: Job<EmailJobData>) => {
    const { to, name } = job.data;
    
    if (!to || !name) {
      throw new Error(`Job ${job.id} missing required 'to' or 'name' data`);
    }

    console.log(`\n[Worker] ⚙️ Processing job ${job.id} (Type: ${job.name}, Attempt: ${job.attemptsMade + 1})`);
    console.log(`[Worker] 📧 Sending email to: ${name} <${to}>`);
    
    // Simulate network/SMTP delay
    await new Promise((resolve) => setTimeout(resolve, 1000));
    
    // Simulate random failure (30% chance) to demonstrate exponential backoff & retries
    if (Math.random() < 0.3) {
      throw new Error('Simulated network/SMTP failure while sending email');
    }

    console.log(`[Worker] ✅ Successfully sent email to ${to}`);
    return { success: true, deliveredTo: to, timestamp: new Date().toISOString() };
  },
  {
    connection: redisConnection.duplicate() as any,
    // Rate Limiting (CRITICAL requirement: max 5 jobs per 10 seconds)
    limiter: {
      max: 5,
      duration: 10000,
    },
    // Safe concurrency handling
    concurrency: 5,
  }
);

// ==========================================
// 📊 Job Lifecycle Logging
// ==========================================

emailWorker.on('active', (job) => {
  console.log(`[Event] Job ${job.id} is now ACTIVE and processing`);
});

emailWorker.on('completed', (job, returnvalue) => {
  console.log(`[Event] Job ${job.id} COMPLETED successfully:`, returnvalue);
});

emailWorker.on('failed', (job, err) => {
  if (job) {
    console.error(`[Event] ❌ Job ${job.id} FAILED with error: ${err.message}`);
    console.error(`[Event] 🔄 Retry attempt: ${job.attemptsMade} of ${job.opts.attempts}`);
    
    if (job.attemptsMade === job.opts.attempts) {
      console.error(`[Event] 🚨 Job ${job.id} has PERMANENTLY FAILED after all retries`);
    }
  } else {
    console.error(`[Event] Worker error: ${err.message}`);
  }
});

emailWorker.on('error', (err) => {
  console.error(`[Worker Error] ${err.message}`);
});

console.log('[Worker] 🚀 Started and listening for jobs on email-queue...');

// Graceful Shutdown Handling
if (require.main === module) {
  const shutdown = async () => {
    console.log('\n[Worker] Shutting down gracefully...');
    await emailWorker.close();
    await redisConnection.quit();
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}
