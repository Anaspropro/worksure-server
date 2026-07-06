import { Injectable } from '@nestjs/common';
import { HealthIndicator, HealthIndicatorResult, HealthCheckError } from '@nestjs/terminus';
import { emailQueue, payoutQueue, escrowQueue } from '../../queue/queue';

@Injectable()
export class BullMQHealthIndicator extends HealthIndicator {
  async isHealthy(key: string): Promise<HealthIndicatorResult> {
    const details: Record<string, any> = {};
    let isHealthy = true;

    const queues = [
      { name: 'email-queue', queue: emailQueue },
      { name: 'payout-queue', queue: payoutQueue },
      { name: 'escrow-queue', queue: escrowQueue },
    ];

    for (const { name, queue } of queues) {
      try {
        const [active, waiting, completed, failed, delayed] = await Promise.all([
          queue.getActiveCount(),
          queue.getWaitingCount(),
          queue.getCompletedCount(),
          queue.getFailedCount(),
          queue.getDelayedCount(),
        ]);

        // Get the oldest waiting job to calculate lag
        const jobs = await queue.getJobs(['waiting'], 0, 0, true);
        const oldestJob = jobs[0];
        let oldestJobAgeMs = 0;
        if (oldestJob && oldestJob.timestamp) {
          oldestJobAgeMs = Date.now() - oldestJob.timestamp;
        }

        // Unhealthy if a job has been waiting for more than 5 minutes
        const isBackedUp = oldestJobAgeMs > 5 * 60 * 1000;

        details[name] = {
          status: isBackedUp ? 'backed_up' : 'up',
          active,
          waiting,
          completed,
          failed,
          delayed,
          oldestJobAgeMs,
        };

        if (isBackedUp) {
          isHealthy = false;
        }
      } catch (error: any) {
        isHealthy = false;
        details[name] = {
          status: 'down',
          error: error.message,
        };
      }
    }

    const result = this.getStatus(key, isHealthy, details);

    if (isHealthy) {
      return result;
    }

    throw new HealthCheckError('BullMQ Queue Health check failed', result);
  }
}
