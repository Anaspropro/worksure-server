import { Injectable } from '@nestjs/common';
import { ThrottlerStorage } from '@nestjs/throttler';
import { ThrottlerStorageRecord } from '@nestjs/throttler/dist/throttler-storage-record.interface';
import { redisConnection } from '../../queue/redis';

@Injectable()
export class RedisThrottlerStorage implements ThrottlerStorage {
  async increment(
    key: string,
    ttl: number, // ttl in milliseconds
    limit: number,
    blockDuration: number, // blockDuration in milliseconds
    throttlerName: string,
  ): Promise<ThrottlerStorageRecord> {
    const cleanKey = `throttler:${throttlerName}:${key}`;
    const blockKey = `${cleanKey}:blocked`;

    // 1. Check if user is currently blocked
    const blockTtlMs = await redisConnection.pttl(blockKey); // returns remaining TTL in ms, or -2 if doesn't exist
    if (blockTtlMs > 0) {
      return {
        totalHits: limit + 1,
        timeToExpire: 0,
        isBlocked: true,
        timeToBlockExpire: Math.ceil(blockTtlMs / 1000),
      };
    }

    // 2. Increment hits and get TTL atomically using a pipeline
    const pipeline = redisConnection.pipeline();
    pipeline.incr(cleanKey);
    pipeline.pttl(cleanKey); // get TTL in milliseconds
    const results = await pipeline.exec();

    if (!results || results.length < 2) {
      throw new Error('Redis pipeline failed to execute');
    }

    // ioredis exec returns array of [error, result]
    const totalHits = results[0][1] as number;
    let currentTtlMs = results[1][1] as number;

    // If key is new, its TTL will be negative (either -1 if no TTL, or -2 if expired/not found).
    // Set expiry to ttl (passed in ms).
    if (currentTtlMs < 0) {
      await redisConnection.pexpire(cleanKey, ttl);
      currentTtlMs = ttl;
    }

    const timeToExpire = Math.ceil(currentTtlMs / 1000);

    // 3. Check if limit is breached
    if (totalHits > limit) {
      // Set the block key for blockDuration (in milliseconds)
      await redisConnection.set(blockKey, '1', 'PX', blockDuration);
      return {
        totalHits,
        timeToExpire,
        isBlocked: true,
        timeToBlockExpire: Math.ceil(blockDuration / 1000),
      };
    }

    return {
      totalHits,
      timeToExpire,
      isBlocked: false,
      timeToBlockExpire: 0,
    };
  }
}
