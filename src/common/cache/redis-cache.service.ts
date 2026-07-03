import { Injectable, Logger } from '@nestjs/common';
import { redisConnection } from '../../queue/redis';
import { v7 as uuidv7 } from 'uuid';

@Injectable()
export class RedisCacheService {
  private readonly logger = new Logger(RedisCacheService.name);

  /**
   * Get an item from the cache
   * @param key The cache key
   */
  async get<T>(key: string): Promise<T | undefined> {
    try {
      const val = await redisConnection.get(key);
      if (!val) return undefined;
      return JSON.parse(val) as T;
    } catch (e) {
      this.logger.error(`Error fetching cache key ${key}: ${e.message}`);
      return undefined;
    }
  }

  /**
   * Set an item in the cache
   * @param key The cache key
   * @param value The value to cache
   * @param ttl Time to live in milliseconds (optional)
   */
  async set<T>(key: string, value: T, ttl?: number): Promise<void> {
    try {
      const strVal = JSON.stringify(value);
      if (ttl !== undefined) {
        await redisConnection.set(key, strVal, 'PX', ttl);
      } else {
        await redisConnection.set(key, strVal);
      }
    } catch (e) {
      this.logger.error(`Error setting cache key ${key}: ${e.message}`);
    }
  }

  /**
   * Delete an item from the cache
   * @param key The cache key
   */
  async del(key: string): Promise<void> {
    try {
      await redisConnection.del(key);
    } catch (e) {
      this.logger.error(`Error deleting cache key ${key}: ${e.message}`);
    }
  }

  /**
   * Invalidate cache keys matching a specific pattern
   * @param pattern The pattern to match (e.g., '/admin/jobs*')
   */
  async invalidatePattern(pattern: string): Promise<void> {
    try {
      let cursor = '0';
      do {
        const [nextCursor, keys] = await redisConnection.scan(cursor, 'MATCH', pattern, 'COUNT', 100);
        cursor = nextCursor;
        if (keys.length > 0) {
          await redisConnection.del(...keys);
        }
      } while (cursor !== '0');
    } catch (e) {
      this.logger.error(`Error invalidating pattern ${pattern}: ${e.message}`);
    }
  }

  /**
   * Acquire a distributed lock using Redis SET NX
   * @param key The lock key
   * @param ttlMs Time to live in milliseconds
   * @returns A string token if lock acquired, else null
   */
  async acquireLock(key: string, ttlMs: number = 5000): Promise<string | null> {
    try {
      const token = uuidv7();
      const acquired = await redisConnection.set(key, token, 'PX', ttlMs, 'NX');
      if (acquired === 'OK') {
        return token;
      }
      return null;
    } catch (e) {
      this.logger.error(`Error acquiring lock ${key}: ${e.message}`);
      return null;
    }
  }

  /**
   * Release a distributed lock safely using a Lua script
   * @param key The lock key
   * @param token The token returned by acquireLock
   */
  async releaseLock(key: string, token: string): Promise<boolean> {
    try {
      const script = `
        if redis.call("get", KEYS[1]) == ARGV[1] then
          return redis.call("del", KEYS[1])
        else
          return 0
        end
      `;
      const result = await redisConnection.eval(script, 1, key, token);
      return result === 1;
    } catch (e) {
      this.logger.error(`Error releasing lock ${key}: ${e.message}`);
      return false;
    }
  }
}
