import { Queue, DefaultJobOptions } from 'bullmq';
import { redisConnection } from './redis';

/**
 * Default options for all jobs in the queue
 */
const defaultJobOptions: DefaultJobOptions = {
  // Retries (VERY IMPORTANT)
  attempts: 5,
  backoff: {
    type: 'exponential',
    delay: 2000,
  },
  removeOnComplete: true, // Keep Redis clean
  removeOnFail: false,    // Keep failed jobs for inspection
};

/**
 * Create the BullMQ email-queue
 */
export const emailQueue = new Queue('email-queue', {
  connection: redisConnection as any,
  defaultJobOptions,
});

/**
 * Job Priorities
 */
export enum EmailJobPriority {
  VIP = 1,      // Highest priority
  NORMAL = 5,   // Standard priority
  LOW = 10,     // Bulk/Marketing priority
}

/**
 * Expected Job Data Structure
 */
export interface EmailJobData {
  to: string;
  name: string;
}

/**
 * Expected Payout Job Data Structure
 */
export interface PayoutJobData {
  transactionId: string;
  adminId: string;
}

/**
 * Create the BullMQ payout-queue
 */
export const payoutQueue = new Queue('payout-queue', {
  connection: redisConnection as any,
  defaultJobOptions,
});

export const escrowQueue = new Queue('escrow-queue', {
  connection: redisConnection as any,
  defaultJobOptions,
});
