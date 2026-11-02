import { RedisCacheService } from './redis-cache.service';
import { InMemoryCacheService } from './in-memory-cache.service';
import { redisConnection } from '../../queue/redis';

jest.mock('../../queue/redis', () => ({
  redisConnection: {
    status: 'ready',
    get: jest.fn(),
    set: jest.fn(),
    del: jest.fn(),
    scan: jest.fn(),
    eval: jest.fn(),
    on: jest.fn(),
  },
}));

describe('RedisCacheService with In-Memory Fallback', () => {
  let service: RedisCacheService;
  let inMemoryCache: InMemoryCacheService;

  beforeEach(() => {
    jest.clearAllMocks();
    (redisConnection as any).status = 'ready';
    inMemoryCache = new InMemoryCacheService();
    service = new RedisCacheService(inMemoryCache);
  });

  afterEach(() => {
    inMemoryCache.onModuleDestroy();
  });

  describe('When Redis is present and operational', () => {
    it('should fetch data from Redis when present', async () => {
      (redisConnection.get as jest.Mock).mockResolvedValue(
        JSON.stringify({ id: 1, name: 'Plumber' }),
      );

      const result = await service.get<{ id: number; name: string }>(
        'taxonomy:category:1',
      );

      expect(redisConnection.get).toHaveBeenCalledWith('taxonomy:category:1');
      expect(result).toEqual({ id: 1, name: 'Plumber' });
    });

    it('should set data in Redis and mirror in in-memory fallback', async () => {
      (redisConnection.set as jest.Mock).mockResolvedValue('OK');

      await service.set('test:key', { foo: 'bar' }, 60000);

      expect(redisConnection.set).toHaveBeenCalledWith(
        'test:key',
        JSON.stringify({ foo: 'bar' }),
        'PX',
        60000,
      );
      // Mirrored in fallback
      expect(inMemoryCache.get('test:key')).toEqual({ foo: 'bar' });
    });

    it('should acquire and release locks in Redis', async () => {
      (redisConnection.set as jest.Mock).mockResolvedValue('OK');
      (redisConnection.eval as jest.Mock).mockResolvedValue(1);

      const token = await service.acquireLock('lock:wallet:123', 5000);
      expect(token).toBeTruthy();
      expect(redisConnection.set).toHaveBeenCalledWith(
        'lock:wallet:123',
        token,
        'PX',
        5000,
        'NX',
      );

      const released = await service.releaseLock('lock:wallet:123', token!);
      expect(released).toBe(true);
      expect(redisConnection.eval).toHaveBeenCalled();
    });
  });

  describe('When Redis is NOT present (Fallback Mode)', () => {
    beforeEach(() => {
      // Simulate Redis being disconnected / not present
      (redisConnection as any).status = 'close';
      service = new RedisCacheService(inMemoryCache);
    });

    it('should gracefully set and get from in-memory fallback without touching Redis', async () => {
      await service.set('user:profile:99', { username: 'testuser' }, 10000);

      expect(redisConnection.set).not.toHaveBeenCalled();

      const profile = await service.get<{ username: string }>(
        'user:profile:99',
      );
      expect(redisConnection.get).not.toHaveBeenCalled();
      expect(profile).toEqual({ username: 'testuser' });
    });

    it('should invalidate patterns in in-memory fallback without touching Redis', async () => {
      await service.set('admin/jobs/10', { title: 'Job 10' });
      await service.set('admin/jobs/11', { title: 'Job 11' });
      await service.set('admin/users/10', { name: 'User 10' });

      await service.invalidatePattern('*admin/jobs*');

      expect(redisConnection.scan).not.toHaveBeenCalled();
      expect(await service.get('admin/jobs/10')).toBeUndefined();
      expect(await service.get('admin/jobs/11')).toBeUndefined();
      expect(await service.get('admin/users/10')).toEqual({ name: 'User 10' });
    });

    it('should acquire and release distributed locks in in-memory fallback', async () => {
      const lockKey = 'lock:payment:tx-777';
      const token = await service.acquireLock(lockKey, 5000);

      expect(token).toBeTruthy();
      expect(redisConnection.set).not.toHaveBeenCalled();

      // Second acquire should be rejected
      const concurrent = await service.acquireLock(lockKey, 5000);
      expect(concurrent).toBeNull();

      // Release with correct token
      const released = await service.releaseLock(lockKey, token!);
      expect(released).toBe(true);

      // Can acquire again
      const nextToken = await service.acquireLock(lockKey, 5000);
      expect(nextToken).toBeTruthy();
    });
  });

  describe('When Redis errors mid-operation (Graceful Degradation)', () => {
    it('should fall back to in-memory cache if Redis get throws error', async () => {
      // Pre-warm fallback
      inMemoryCache.set('cat:1', { name: 'Carpentry' });

      (redisConnection.get as jest.Mock).mockRejectedValue(
        new Error('Connection reset by peer'),
      );

      const result = await service.get('cat:1');

      expect(result).toEqual({ name: 'Carpentry' });
    });

    it('should fall back to in-memory lock if Redis acquireLock throws', async () => {
      (redisConnection.set as jest.Mock).mockRejectedValue(
        new Error('Command timed out'),
      );

      const token = await service.acquireLock('lock:fallback:1', 5000);

      expect(token).toBeTruthy();
      expect(inMemoryCache.lockCount).toBe(1);
    });
  });
});
