import { InMemoryCacheService } from './in-memory-cache.service';

describe('InMemoryCacheService', () => {
  let cache: InMemoryCacheService;

  beforeEach(() => {
    cache = new InMemoryCacheService();
  });

  afterEach(() => {
    cache.onModuleDestroy();
  });

  it('should store and retrieve values', () => {
    cache.set('key1', { hello: 'world' });
    expect(cache.get('key1')).toEqual({ hello: 'world' });
    expect(cache.has('key1')).toBe(true);
  });

  it('should return undefined for missing keys', () => {
    expect(cache.get('nonexistent')).toBeUndefined();
    expect(cache.has('nonexistent')).toBe(false);
  });

  it('should delete keys properly', () => {
    cache.set('key1', 'value1');
    expect(cache.has('key1')).toBe(true);

    cache.del('key1');
    expect(cache.has('key1')).toBe(false);
    expect(cache.get('key1')).toBeUndefined();
  });

  it('should expire keys based on TTL', async () => {
    cache.set('tempKey', 'willExpire', 50); // 50ms TTL
    expect(cache.get('tempKey')).toBe('willExpire');

    await new Promise((resolve) => setTimeout(resolve, 60));
    expect(cache.get('tempKey')).toBeUndefined();
  });

  it('should invalidate keys matching glob patterns', () => {
    cache.set('admin/jobs/1', 'job1');
    cache.set('admin/jobs/2', 'job2');
    cache.set('admin/users/1', 'user1');
    cache.set('analytics:report:weekly', 'weekly-report');
    cache.set('analytics:report:monthly', 'monthly-report');

    expect(cache.size).toBe(5);

    const removedJobs = cache.invalidatePattern('*admin/jobs*');
    expect(removedJobs).toBe(2);
    expect(cache.get('admin/jobs/1')).toBeUndefined();
    expect(cache.get('admin/jobs/2')).toBeUndefined();
    expect(cache.get('admin/users/1')).toBe('user1');

    const removedAnalytics = cache.invalidatePattern('analytics:report:*');
    expect(removedAnalytics).toBe(2);
    expect(cache.get('analytics:report:weekly')).toBeUndefined();
    expect(cache.get('admin/users/1')).toBe('user1');
    expect(cache.size).toBe(1);
  });

  describe('Distributed Lock Simulation', () => {
    it('should acquire lock and prevent concurrent acquisition', () => {
      const lockKey = 'lock:wallet:user-123';
      const token1 = cache.acquireLock(lockKey, 5000);

      expect(token1).toBeTruthy();
      expect(typeof token1).toBe('string');

      // Attempting to acquire again while lock is active should return null
      const token2 = cache.acquireLock(lockKey, 5000);
      expect(token2).toBeNull();
    });

    it('should release lock with correct token and allow re-acquisition', () => {
      const lockKey = 'lock:payment:pay-456';
      const token = cache.acquireLock(lockKey, 5000)!;

      // Releasing with wrong token should fail
      const releasedWrong = cache.releaseLock(lockKey, 'wrong-token');
      expect(releasedWrong).toBe(false);

      // Releasing with correct token should succeed
      const releasedCorrect = cache.releaseLock(lockKey, token);
      expect(releasedCorrect).toBe(true);

      // Should be able to acquire again
      const newToken = cache.acquireLock(lockKey, 5000);
      expect(newToken).toBeTruthy();
      expect(newToken).not.toBe(token);
    });

    it('should allow acquiring lock after previous lock expires', async () => {
      const lockKey = 'lock:quick';
      const token1 = cache.acquireLock(lockKey, 50)!; // 50ms TTL
      expect(token1).toBeTruthy();

      await new Promise((resolve) => setTimeout(resolve, 60));

      const token2 = cache.acquireLock(lockKey, 5000);
      expect(token2).toBeTruthy();
    });
  });

  it('should clean up expired entries in cleanupExpired', async () => {
    cache.set('live', 'keep', 10000);
    cache.set('dead', 'drop', 20);
    cache.acquireLock('dead-lock', 20);

    await new Promise((resolve) => setTimeout(resolve, 30));

    cache.cleanupExpired();
    expect(cache.get('dead')).toBeUndefined();
    expect(cache.get('live')).toBe('keep');
    expect(cache.lockCount).toBe(0);
  });
});
