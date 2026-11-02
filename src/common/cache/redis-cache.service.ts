import { Injectable, Logger, Optional, Inject } from '@nestjs/common';
import { redisConnection } from '../../queue/redis';
import { InMemoryCacheService } from './in-memory-cache.service';
import { v7 as uuidv7 } from 'uuid';

@Injectable()
export class RedisCacheService {
  private readonly logger = new Logger(RedisCacheService.name);
  private isRedisConnected = false;
  private lastRedisErrorTimestamp = 0;
  private readonly REDIS_COOLDOWN_MS = 10000; // 10s circuit-breaker cooldown

  constructor(
    @Optional()
    @Inject(InMemoryCacheService)
    private readonly inMemoryCache: InMemoryCacheService = new InMemoryCacheService(),
  ) {
    this.initRedisListeners();
  }

  private initRedisListeners(): void {
    if (!redisConnection) return;

    if (redisConnection.status === 'ready') {
      this.isRedisConnected = true;
    }

    redisConnection.on('ready', () => {
      this.isRedisConnected = true;
      this.logger.log(
        'Redis connection established and ready. Primary cache store active.',
      );
    });

    redisConnection.on('connect', () => {
      // Stream connected, waiting for ready event
    });

    redisConnection.on('error', (err) => {
      this.isRedisConnected = false;
      this.tripCircuitBreaker();
      if (Date.now() - this.lastRedisErrorTimestamp > 30000) {
        this.logger.warn(
          `Redis error: ${err.message}. Operating with in-memory cache fallback.`,
        );
        this.lastRedisErrorTimestamp = Date.now();
      }
    });

    redisConnection.on('close', () => {
      this.isRedisConnected = false;
    });

    redisConnection.on('end', () => {
      this.isRedisConnected = false;
    });
  }

  /**
   * Check if Redis is present and ready for operations
   */
  public isRedisAvailable(): boolean {
    if (!redisConnection) return false;
    // In test mocks or non-ready states, verify status
    const status = redisConnection.status;
    const isReady = status === 'ready' || status === undefined; // undefined if mock without status
    const isCooldownActive =
      Date.now() - this.lastRedisErrorTimestamp < this.REDIS_COOLDOWN_MS;
    return isReady && !isCooldownActive;
  }

  private tripCircuitBreaker(): void {
    this.lastRedisErrorTimestamp = Date.now();
  }

  /**
   * Helper to execute Redis command with safety timeout to avoid hanging if connection stalls
   */
  private async execWithTimeout<T>(
    operation: () => Promise<T>,
    timeoutMs = 1500,
  ): Promise<T> {
    let timer: NodeJS.Timeout;
    const timeoutPromise = new Promise<T>((_, reject) => {
      timer = setTimeout(
        () => reject(new Error('Redis operation timed out')),
        timeoutMs,
      );
      if (timer.unref) timer.unref();
    });

    try {
      return await Promise.race([operation(), timeoutPromise]);
    } finally {
      clearTimeout(timer!);
    }
  }

  /**
   * Get an item from the cache
   * Falls back to in-memory cache if Redis is not present or throws
   * @param key The cache key
   */
  async get<T>(key: string): Promise<T | undefined> {
    if (this.isRedisAvailable()) {
      try {
        const val = await this.execWithTimeout(() => redisConnection.get(key));
        if (val) {
          return JSON.parse(val) as T;
        }
        // If not in Redis, check local fallback
        return this.inMemoryCache.get<T>(key);
      } catch (e) {
        this.tripCircuitBreaker();
        this.logger.warn(
          `Redis get error for key "${key}": ${e.message}. Falling back to in-memory cache.`,
        );
        return this.inMemoryCache.get<T>(key);
      }
    }

    // Redis unavailable: retrieve directly from in-memory cache fallback
    return this.inMemoryCache.get<T>(key);
  }

  /**
   * Set an item in the cache
   * Stores in both in-memory cache (for instant fallback) and Redis
   * @param key The cache key
   * @param value The value to cache
   * @param ttl Time to live in milliseconds (optional)
   */
  async set<T>(key: string, value: T, ttl?: number): Promise<void> {
    // Always write to in-memory fallback to keep local tier warm and coherent
    this.inMemoryCache.set(key, value, ttl);

    if (this.isRedisAvailable()) {
      try {
        const strVal = JSON.stringify(value);
        if (ttl !== undefined) {
          await this.execWithTimeout(() =>
            redisConnection.set(key, strVal, 'PX', ttl),
          );
        } else {
          await this.execWithTimeout(() => redisConnection.set(key, strVal));
        }
      } catch (e) {
        this.tripCircuitBreaker();
        this.logger.warn(
          `Redis set error for key "${key}": ${e.message}. Preserved in in-memory cache fallback.`,
        );
      }
    }
  }

  /**
   * Delete an item from the cache
   * Deletes from both in-memory cache and Redis
   * @param key The cache key
   */
  async del(key: string): Promise<void> {
    this.inMemoryCache.del(key);

    if (this.isRedisAvailable()) {
      try {
        await this.execWithTimeout(() => redisConnection.del(key));
      } catch (e) {
        this.tripCircuitBreaker();
        this.logger.warn(
          `Redis del error for key "${key}": ${e.message}. Deleted from in-memory cache fallback.`,
        );
      }
    }
  }

  /**
   * Invalidate cache keys matching a specific pattern (e.g. '*admin/jobs*')
   * Invalidates in both in-memory cache and Redis
   * @param pattern The pattern to match
   */
  async invalidatePattern(pattern: string): Promise<void> {
    this.inMemoryCache.invalidatePattern(pattern);

    if (this.isRedisAvailable()) {
      try {
        let cursor = '0';
        do {
          const [nextCursor, keys] = await this.execWithTimeout(() =>
            redisConnection.scan(cursor, 'MATCH', pattern, 'COUNT', 100),
          );
          cursor = nextCursor;
          if (keys.length > 0) {
            await this.execWithTimeout(() => redisConnection.del(...keys));
          }
        } while (cursor !== '0');
      } catch (e) {
        this.tripCircuitBreaker();
        this.logger.warn(
          `Redis invalidatePattern error for pattern "${pattern}": ${e.message}. Invalidated in in-memory cache fallback.`,
        );
      }
    }
  }

  /**
   * Acquire a distributed lock using Redis SET NX, or fallback to in-memory lock
   * @param key The lock key
   * @param ttlMs Time to live in milliseconds
   * @returns A string token if lock acquired, else null
   */
  async acquireLock(key: string, ttlMs: number = 5000): Promise<string | null> {
    if (this.isRedisAvailable()) {
      try {
        const token = uuidv7();
        const acquired = await this.execWithTimeout(() =>
          redisConnection.set(key, token, 'PX', ttlMs, 'NX'),
        );
        if (acquired === 'OK') {
          // Mirror in local fallback
          this.inMemoryCache.acquireLock(key, ttlMs);
          return token;
        }
        return null;
      } catch (e) {
        this.tripCircuitBreaker();
        this.logger.warn(
          `Redis acquireLock error for key "${key}": ${e.message}. Falling back to in-memory lock.`,
        );
        return this.inMemoryCache.acquireLock(key, ttlMs);
      }
    }

    // Redis unavailable: acquire in-memory lock
    return this.inMemoryCache.acquireLock(key, ttlMs);
  }

  /**
   * Release a distributed lock safely using Lua script or in-memory fallback
   * @param key The lock key
   * @param token The token returned by acquireLock
   */
  async releaseLock(key: string, token: string): Promise<boolean> {
    const memReleased = this.inMemoryCache.releaseLock(key, token);

    if (this.isRedisAvailable()) {
      try {
        const script = `
          if redis.call("get", KEYS[1]) == ARGV[1] then
            return redis.call("del", KEYS[1])
          else
            return 0
          end
        `;
        const result = await this.execWithTimeout(() =>
          redisConnection.eval(script, 1, key, token),
        );
        return result === 1 || memReleased;
      } catch (e) {
        this.tripCircuitBreaker();
        this.logger.warn(
          `Redis releaseLock error for key "${key}": ${e.message}. Released via in-memory lock fallback.`,
        );
        return memReleased;
      }
    }

    return memReleased;
  }

  /**
   * Diagnostic statistics for cache telemetry and monitoring
   */
  getStats() {
    return {
      isRedisAvailable: this.isRedisAvailable(),
      redisStatus: redisConnection?.status ?? 'none',
      inMemoryEntries: this.inMemoryCache.size,
      inMemoryLocks: this.inMemoryCache.lockCount,
    };
  }
}
