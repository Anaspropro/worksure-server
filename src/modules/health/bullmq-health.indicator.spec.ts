import { BullMQHealthIndicator } from './bullmq-health.indicator';
import { emailQueue, payoutQueue, escrowQueue } from '../../queue/queue';
import { HealthCheckError } from '@nestjs/terminus';

jest.mock('../../queue/queue', () => ({
  emailQueue: {
    getActiveCount: jest.fn(),
    getWaitingCount: jest.fn(),
    getCompletedCount: jest.fn(),
    getFailedCount: jest.fn(),
    getDelayedCount: jest.fn(),
    getJobs: jest.fn(),
  },
  payoutQueue: {
    getActiveCount: jest.fn(),
    getWaitingCount: jest.fn(),
    getCompletedCount: jest.fn(),
    getFailedCount: jest.fn(),
    getDelayedCount: jest.fn(),
    getJobs: jest.fn(),
  },
  escrowQueue: {
    getActiveCount: jest.fn(),
    getWaitingCount: jest.fn(),
    getCompletedCount: jest.fn(),
    getFailedCount: jest.fn(),
    getDelayedCount: jest.fn(),
    getJobs: jest.fn(),
  },
}));

describe('BullMQHealthIndicator', () => {
  let indicator: BullMQHealthIndicator;

  beforeEach(() => {
    indicator = new BullMQHealthIndicator();
    jest.clearAllMocks();
  });

  it('should report healthy when all queues are up and not backed up', async () => {
    (emailQueue.getActiveCount as jest.Mock).mockResolvedValue(0);
    (emailQueue.getWaitingCount as jest.Mock).mockResolvedValue(0);
    (emailQueue.getCompletedCount as jest.Mock).mockResolvedValue(10);
    (emailQueue.getFailedCount as jest.Mock).mockResolvedValue(0);
    (emailQueue.getDelayedCount as jest.Mock).mockResolvedValue(0);
    (emailQueue.getJobs as jest.Mock).mockResolvedValue([]);

    (payoutQueue.getActiveCount as jest.Mock).mockResolvedValue(0);
    (payoutQueue.getWaitingCount as jest.Mock).mockResolvedValue(0);
    (payoutQueue.getCompletedCount as jest.Mock).mockResolvedValue(5);
    (payoutQueue.getFailedCount as jest.Mock).mockResolvedValue(0);
    (payoutQueue.getDelayedCount as jest.Mock).mockResolvedValue(0);
    (payoutQueue.getJobs as jest.Mock).mockResolvedValue([]);

    (escrowQueue.getActiveCount as jest.Mock).mockResolvedValue(0);
    (escrowQueue.getWaitingCount as jest.Mock).mockResolvedValue(0);
    (escrowQueue.getCompletedCount as jest.Mock).mockResolvedValue(5);
    (escrowQueue.getFailedCount as jest.Mock).mockResolvedValue(0);
    (escrowQueue.getDelayedCount as jest.Mock).mockResolvedValue(0);
    (escrowQueue.getJobs as jest.Mock).mockResolvedValue([]);

    const result = await indicator.isHealthy('queues');

    expect(result).toEqual({
      queues: {
        status: 'up',
        'email-queue': {
          status: 'up',
          active: 0,
          waiting: 0,
          completed: 10,
          failed: 0,
          delayed: 0,
          oldestJobAgeMs: 0,
        },
        'payout-queue': {
          status: 'up',
          active: 0,
          waiting: 0,
          completed: 5,
          failed: 0,
          delayed: 0,
          oldestJobAgeMs: 0,
        },
        'escrow-queue': {
          status: 'up',
          active: 0,
          waiting: 0,
          completed: 5,
          failed: 0,
          delayed: 0,
          oldestJobAgeMs: 0,
        },
      },
    });
  });

  it('should report unhealthy (backed_up) if a queue contains job waiting more than 5 minutes', async () => {
    (emailQueue.getActiveCount as jest.Mock).mockResolvedValue(0);
    (emailQueue.getWaitingCount as jest.Mock).mockResolvedValue(1);
    (emailQueue.getCompletedCount as jest.Mock).mockResolvedValue(10);
    (emailQueue.getFailedCount as jest.Mock).mockResolvedValue(0);
    (emailQueue.getDelayedCount as jest.Mock).mockResolvedValue(0);
    (emailQueue.getJobs as jest.Mock).mockResolvedValue([
      { timestamp: Date.now() - 6 * 60 * 1000 }, // 6 minutes ago
    ]);

    (payoutQueue.getActiveCount as jest.Mock).mockResolvedValue(0);
    (payoutQueue.getWaitingCount as jest.Mock).mockResolvedValue(0);
    (payoutQueue.getCompletedCount as jest.Mock).mockResolvedValue(5);
    (payoutQueue.getFailedCount as jest.Mock).mockResolvedValue(0);
    (payoutQueue.getDelayedCount as jest.Mock).mockResolvedValue(0);
    (payoutQueue.getJobs as jest.Mock).mockResolvedValue([]);

    (escrowQueue.getActiveCount as jest.Mock).mockResolvedValue(0);
    (escrowQueue.getWaitingCount as jest.Mock).mockResolvedValue(0);
    (escrowQueue.getCompletedCount as jest.Mock).mockResolvedValue(5);
    (escrowQueue.getFailedCount as jest.Mock).mockResolvedValue(0);
    (escrowQueue.getDelayedCount as jest.Mock).mockResolvedValue(0);
    (escrowQueue.getJobs as jest.Mock).mockResolvedValue([]);

    await expect(indicator.isHealthy('queues')).rejects.toThrow(
      HealthCheckError,
    );
  });

  it('should report unhealthy if querying queue fails', async () => {
    (emailQueue.getActiveCount as jest.Mock).mockRejectedValue(
      new Error('Redis lost'),
    );

    await expect(indicator.isHealthy('queues')).rejects.toThrow(
      HealthCheckError,
    );
  });
});
