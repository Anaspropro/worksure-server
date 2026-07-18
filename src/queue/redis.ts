import Redis from 'ioredis';
import * as dotenv from 'dotenv';

// Ensure environment variables are loaded if run independently
dotenv.config({ override: true });

const redisUrl = process.env.REDIS_URL;

if (!redisUrl) {
  throw new Error('REDIS_URL environment variable is missing');
}

import type { RedisOptions } from 'ioredis';

const redisOptions: RedisOptions = {
  maxRetriesPerRequest: null, // Required for BullMQ
  family: 0, // Prefer IPv4
  tls: {
    rejectUnauthorized: false
  },
  enableReadyCheck: false,
  connectTimeout: 30000, // Increased timeout to 30s
  keepAlive: 10000, // Send keep-alive every 10s to prevent stale connections
  retryStrategy(times) {
    // Exponential backoff with a max of 3 seconds
    const delay = Math.min(times * 200, 3000);
    return delay;
  },
  reconnectOnError(err) {
    const targetErrors = ['READONLY', 'ETIMEDOUT', 'ECONNRESET'];
    if (targetErrors.some(target => err.message.includes(target))) {
      return true;
    }
    return false;
  },
};

export const redisConnection = new Redis(redisUrl, redisOptions);

redisConnection.on('error', (err) => {
  console.error('[Redis] Connection error:', err);
});

redisConnection.on('connect', () => {
  console.log('[Redis] Connected successfully');
});
