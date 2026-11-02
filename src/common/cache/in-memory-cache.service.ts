import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { v7 as uuidv7 } from 'uuid';

export interface CacheEntry<T> {
  value: T;
  expiresAt: number | null; // null means no expiration
  createdAt: number;
}

export interface LockEntry {
  token: string;
  expiresAt: number;
}

@Injectable()
export class InMemoryCacheService implements OnModuleDestroy {
  private readonly logger = new Logger(InMemoryCacheService.name);
  private readonly store = new Map<string, CacheEntry<any>>();
  private readonly locks = new Map<string, LockEntry>();
  private readonly maxEntries = 10000;
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor() {
    // Run garbage collection sweep every 60 seconds
    this.cleanupInterval = setInterval(() => {
      this.cleanupExpired();
    }, 60000);

    if (this.cleanupInterval?.unref) {
      this.cleanupInterval.unref();
    }
  }

  onModuleDestroy() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    this.clear();
  }

  /**
   * Get an item from the in-memory cache
   * @param key The cache key
   */
  get<T>(key: string): T | undefined {
    const entry = this.store.get(key);
    if (!entry) return undefined;

    // Check expiration
    if (entry.expiresAt !== null && Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return undefined;
    }

    return entry.value as T;
  }

  /**
   * Set an item in the in-memory cache
   * @param key The cache key
   * @param value The value to cache
   * @param ttlMs Time to live in milliseconds (optional)
   */
  set<T>(key: string, value: T, ttlMs?: number): void {
    // Bounded capacity: evict oldest entries if map size exceeds limit
    if (this.store.size >= this.maxEntries && !this.store.has(key)) {
      this.evictOldest();
    }

    const expiresAt =
      typeof ttlMs === 'number' && ttlMs > 0 ? Date.now() + ttlMs : null;

    this.store.set(key, {
      value,
      expiresAt,
      createdAt: Date.now(),
    });
  }

  /**
   * Delete an item from the in-memory cache
   * @param key The cache key
   */
  del(key: string): void {
    this.store.delete(key);
  }

  /**
   * Check if a key exists in cache and is not expired
   * @param key The cache key
   */
  has(key: string): boolean {
    return this.get(key) !== undefined;
  }

  /**
   * Invalidate cache keys matching a specific pattern (e.g. '*admin/jobs*', 'analytics:report:*')
   * Supports glob wildcards '*' and '?'
   * @param pattern The wildcard pattern
   * @returns Number of removed keys
   */
  invalidatePattern(pattern: string): number {
    const regex = this.globToRegex(pattern);
    let count = 0;

    for (const key of Array.from(this.store.keys())) {
      if (regex.test(key)) {
        this.store.delete(key);
        count++;
      }
    }

    return count;
  }

  /**
   * Acquire an in-memory lock (mutex simulation with TTL)
   * @param key The lock key
   * @param ttlMs Lock expiry in milliseconds (defaults to 5000ms)
   * @returns UUID token if lock acquired, else null
   */
  acquireLock(key: string, ttlMs: number = 5000): string | null {
    const now = Date.now();
    const existing = this.locks.get(key);

    if (existing && existing.expiresAt > now) {
      // Lock is currently active
      return null;
    }

    const token = uuidv7();
    this.locks.set(key, {
      token,
      expiresAt: now + ttlMs,
    });

    return token;
  }

  /**
   * Release an in-memory lock safely verifying token ownership
   * @param key The lock key
   * @param token The token returned by acquireLock
   */
  releaseLock(key: string, token: string): boolean {
    const existing = this.locks.get(key);
    if (!existing) return false;

    if (existing.token === token) {
      this.locks.delete(key);
      return true;
    }

    return false;
  }

  /**
   * Clear all items and locks
   */
  clear(): void {
    this.store.clear();
    this.locks.clear();
  }

  /**
   * Total number of stored cache entries
   */
  get size(): number {
    return this.store.size;
  }

  /**
   * Total number of active locks
   */
  get lockCount(): number {
    return this.locks.size;
  }

  /**
   * Periodic garbage collection for expired entries and locks
   */
  cleanupExpired(): void {
    const now = Date.now();

    for (const [key, entry] of this.store.entries()) {
      if (entry.expiresAt !== null && now > entry.expiresAt) {
        this.store.delete(key);
      }
    }

    for (const [key, lock] of this.locks.entries()) {
      if (now > lock.expiresAt) {
        this.locks.delete(key);
      }
    }
  }

  /**
   * Converts a Redis glob pattern (* and ?) to a JavaScript RegExp
   */
  private globToRegex(pattern: string): RegExp {
    const escaped = pattern
      .replace(/[.+^${}()|[\]\\]/g, '\\$&')
      .replace(/\*/g, '.*')
      .replace(/\?/g, '.');
    return new RegExp(`^${escaped}$`);
  }

  /**
   * Evicts the oldest 10% entries from the store
   */
  private evictOldest(): void {
    const toRemove = Math.max(1, Math.floor(this.maxEntries * 0.1));
    let removed = 0;

    for (const key of this.store.keys()) {
      this.store.delete(key);
      removed++;
      if (removed >= toRemove) break;
    }
  }
}
