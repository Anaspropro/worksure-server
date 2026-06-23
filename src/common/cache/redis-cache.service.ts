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
}
