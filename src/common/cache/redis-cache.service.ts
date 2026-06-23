import { Injectable, Logger } from '@nestjs/common';
import { redisConnection } from '../../queue/redis';

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
}
