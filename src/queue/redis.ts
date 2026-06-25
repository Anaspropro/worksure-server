import Redis from 'ioredis';
import * as dotenv from 'dotenv';

// Ensure environment variables are loaded if run independently
dotenv.config({ override: true });

const redisUrl = process.env.REDIS_URL;

if (!redisUrl) {
  throw new Error('REDIS_URL environment variable is missing');
}

/**
 * Shared Redis connection for BullMQ
 * maxRetriesPerRequest MUST be set to null for BullMQ to function correctly.
 */
export const redisConnection = new Redis(redisUrl, {
  maxRetriesPerRequest: null,
  // Optimal settings for Upstash / remote serverless Redis
  family: 0,
});

redisConnection.on('error', (err) => {
  console.error('[Redis] Connection error:', err);
});

redisConnection.on('connect', () => {
  console.log('[Redis] Connected successfully');
});
