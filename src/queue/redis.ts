import Redis from 'ioredis';
import * as dotenv from 'dotenv';

// Ensure environment variables are loaded if run independently
dotenv.config({ override: true });

const isTest =
  process.env.NODE_ENV === 'test' || Boolean(process.env.JEST_WORKER_ID);
const redisUrl =
  process.env.REDIS_URL || 'redis://127.0.0.1:6379';

import type { RedisOptions } from 'ioredis';

const isTls = redisUrl.startsWith('rediss://');

const redisOptions: RedisOptions = {
  lazyConnect: isTest,
  maxRetriesPerRequest: null, // Required for BullMQ
  family: 0, // Prefer IPv4
  tls: isTls ? { rejectUnauthorized: false } : undefined,
  enableReadyCheck: false,
  connectTimeout: 30000, // Increased timeout to 30s
  keepAlive: 10000, // Send keep-alive every 10s to prevent stale connections
  retryStrategy(times) {
    if (isTest) return null;
    // Exponential backoff with a max of 3 seconds
    const delay = Math.min(times * 200, 3000);
    return delay;
  },
  reconnectOnError(err) {
    const targetErrors = ['READONLY', 'ETIMEDOUT', 'ECONNRESET'];
    if (targetErrors.some((target) => err.message.includes(target))) {
      return true;
    }
    return false;
  },
};

export const redisConnection = new Redis(redisUrl, redisOptions);

export function getBullRedisOptions(): RedisOptions {
  const url = new URL(redisUrl as string);
  return {
    ...redisOptions,
    host: url.hostname,
    port: parseInt(url.port || '6379'),
    username: url.username || undefined,
    password: url.password || undefined,
    tls: url.protocol === 'rediss:' ? { rejectUnauthorized: false } : undefined,
  };
}

redisConnection.on('error', (err) => {
  if (isTest) return;
  console.error('[Redis] Connection error:', err);
});

redisConnection.on('connect', () => {
  console.log('[Redis] Connected successfully');
});
