import Redis from 'ioredis';
import * as dotenv from 'dotenv';

// Ensure environment variables are loaded if run independently
dotenv.config({ override: true });

const redisUrl = process.env.REDIS_URL;
const useRedis = process.env.USE_REDIS !== 'false' && !!redisUrl;

export let redisConnection: Redis;

if (useRedis) {
  console.log('[Redis] Initializing real Redis connection to:', redisUrl);
  redisConnection = new Redis(redisUrl!, {
    maxRetriesPerRequest: null,
    family: 0,
    tls: {
      rejectUnauthorized: false
    },
    enableReadyCheck: false,
    connectTimeout: 20000,
  });

  redisConnection.on('error', (err) => {
    console.error('[Redis] Connection error:', err);
  });

  redisConnection.on('connect', () => {
    console.log('[Redis] Connected successfully');
  });
} else {
  console.log('[Redis] USE_REDIS is false or REDIS_URL is missing. Using in-memory ioredis-mock.');
  const RedisMock = require('ioredis-mock');
  redisConnection = new RedisMock() as unknown as Redis;
}

