import { Injectable } from '@nestjs/common';
import { ThrottlerStorage } from '@nestjs/throttler';
import { ThrottlerStorageRecord } from '@nestjs/throttler/dist/throttler-storage-record.interface';
import { redisConnection } from '../../queue/redis';

@Injectable()
export class RedisThrottlerStorage implements ThrottlerStorage {
  private readonly memoryHits = new Map<
    string,
    { totalHits: number; expiresAt: number }
  >();
  private readonly memoryBlocks = new Map<string, number>();

  async increment(
    key: string,
    ttl: number, // ttl in milliseconds
    limit: number,
    blockDuration: number, // blockDuration in milliseconds
    throttlerName: string,
  ): Promise<ThrottlerStorageRecord> {
    const cleanKey = `throttler:${throttlerName}:${key}`;
    const blockKey = `${cleanKey}:blocked`;

    const isRedisReady =
      redisConnection &&
      (redisConnection.status === 'ready' ||
        redisConnection.status === undefined);

    if (isRedisReady) {
      try {
        // 1. Check if user is currently blocked in Redis
        const blockTtlMs = await redisConnection.pttl(blockKey);
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

        if (results && results.length >= 2 && !results[0][0]) {
          const totalHits = results[0][1] as number;
          let currentTtlMs = results[1][1] as number;

          // If key is new, its TTL will be negative
          if (currentTtlMs < 0) {
            await redisConnection.pexpire(cleanKey, ttl);
            currentTtlMs = ttl;
          }

          const timeToExpire = Math.ceil(currentTtlMs / 1000);

          // 3. Check if limit is breached
          if (totalHits > limit) {
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
      } catch {
        // If Redis throws or fails, proceed to in-memory fallback below
      }
    }

    // In-memory rate limiting fallback
    const now = Date.now();
    const blockExpiresAt = this.memoryBlocks.get(blockKey);
    if (blockExpiresAt && blockExpiresAt > now) {
      return {
        totalHits: limit + 1,
        timeToExpire: 0,
        isBlocked: true,
        timeToBlockExpire: Math.ceil((blockExpiresAt - now) / 1000),
      };
    }

    let record = this.memoryHits.get(cleanKey);
    if (!record || record.expiresAt <= now) {
      record = { totalHits: 1, expiresAt: now + ttl };
      this.memoryHits.set(cleanKey, record);
    } else {
      record.totalHits += 1;
    }

    const timeToExpire = Math.max(1, Math.ceil((record.expiresAt - now) / 1000));
    if (record.totalHits > limit) {
      this.memoryBlocks.set(blockKey, now + blockDuration);
      return {
        totalHits: record.totalHits,
        timeToExpire,
        isBlocked: true,
        timeToBlockExpire: Math.ceil(blockDuration / 1000),
      };
    }

    return {
      totalHits: record.totalHits,
      timeToExpire,
      isBlocked: false,
      timeToBlockExpire: 0,
    };
  }
}
