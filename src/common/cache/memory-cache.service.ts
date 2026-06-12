import { Inject, Injectable } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';

@Injectable()
export class MemoryCacheService {
  constructor(@Inject(CACHE_MANAGER) private cacheManager: Cache) {}

  /**
   * Get an item from the cache
   * @param key The cache key
   */
  async get<T>(key: string): Promise<T | undefined> {
    return this.cacheManager.get<T>(key);
  }

  /**
   * Set an item in the cache
   * @param key The cache key
   * @param value The value to cache
   * @param ttl Time to live in milliseconds (optional, defaults to cache manager default)
   */
  async set<T>(key: string, value: T, ttl?: number): Promise<void> {
    // In cache-manager v5, ttl is in milliseconds
    if (ttl !== undefined) {
      await this.cacheManager.set(key, value, ttl);
    } else {
      await this.cacheManager.set(key, value);
    }
  }

  /**
   * Delete an item from the cache
   * @param key The cache key
   */
  async del(key: string): Promise<void> {
    await this.cacheManager.del(key);
  }

  /**
   * Clear the entire cache
   */
  async clear(): Promise<void> {
    await this.cacheManager.clear();
  }
}
