import { RedisThrottlerStorage } from './redis-throttler-storage';
import { redisConnection } from '../../queue/redis';

jest.mock('../../queue/redis', () => {
  const mPipeline = {
    incr: jest.fn().mockReturnThis(),
    pttl: jest.fn().mockReturnThis(),
    exec: jest.fn(),
  };
  return {
    redisConnection: {
      ttl: jest.fn(),
      pttl: jest.fn(),
      pipeline: jest.fn().mockReturnValue(mPipeline),
      pexpire: jest.fn(),
      set: jest.fn(),
    },
  };
});

describe('RedisThrottlerStorage', () => {
  let storage: RedisThrottlerStorage;
  let mockPipeline: any;

  beforeEach(() => {
    storage = new RedisThrottlerStorage();
    mockPipeline = redisConnection.pipeline();
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(storage).toBeDefined();
  });

  it('should return blocked state if user is already blocked in Redis', async () => {
    (redisConnection.pttl as jest.Mock).mockResolvedValue(10000); // 10s remaining in ms

    const result = await storage.increment('user-key', 60000, 5, 30000, 'test');

    expect(redisConnection.pttl).toHaveBeenCalledWith(
      'throttler:test:user-key:blocked',
    );
    expect(result).toEqual({
      totalHits: 6, // limit + 1
      timeToExpire: 0,
      isBlocked: true,
      timeToBlockExpire: 10, // 10s
    });
    expect(redisConnection.pipeline).not.toHaveBeenCalled();
  });

  it('should increment hits and set pexpire if new key', async () => {
    (redisConnection.pttl as jest.Mock).mockResolvedValue(-2); // not blocked
    mockPipeline.exec.mockResolvedValue([
      [null, 1], // incr returns 1
      [null, -1], // pttl returns -1 (no expiry)
    ]);
    (redisConnection.pexpire as jest.Mock).mockResolvedValue(1);

    const result = await storage.increment('user-key', 60000, 5, 30000, 'test');

    expect(redisConnection.pipeline).toHaveBeenCalled();
    expect(mockPipeline.incr).toHaveBeenCalledWith('throttler:test:user-key');
    expect(mockPipeline.pttl).toHaveBeenCalledWith('throttler:test:user-key');
    expect(redisConnection.pexpire).toHaveBeenCalledWith(
      'throttler:test:user-key',
      60000,
    );
    expect(result).toEqual({
      totalHits: 1,
      timeToExpire: 60, // 60000ms is 60s
      isBlocked: false,
      timeToBlockExpire: 0,
    });
  });

  it('should return hits and remaining time when under limit', async () => {
    (redisConnection.pttl as jest.Mock).mockResolvedValue(-2);
    mockPipeline.exec.mockResolvedValue([
      [null, 3], // incr returns 3
      [null, 45000], // pttl returns 45000ms
    ]);

    const result = await storage.increment('user-key', 60000, 5, 30000, 'test');

    expect(redisConnection.pexpire).not.toHaveBeenCalled();
    expect(result).toEqual({
      totalHits: 3,
      timeToExpire: 45, // 45s
      isBlocked: false,
      timeToBlockExpire: 0,
    });
  });

  it('should block and return blockDuration when limit is breached', async () => {
    (redisConnection.pttl as jest.Mock).mockResolvedValue(-2);
    mockPipeline.exec.mockResolvedValue([
      [null, 6], // incr returns 6 (limit is 5)
      [null, 45000],
    ]);
    (redisConnection.set as jest.Mock).mockResolvedValue('OK');

    const result = await storage.increment('user-key', 60000, 5, 30000, 'test');

    expect(redisConnection.set).toHaveBeenCalledWith(
      'throttler:test:user-key:blocked',
      '1',
      'PX',
      30000,
    );
    expect(result).toEqual({
      totalHits: 6,
      timeToExpire: 45,
      isBlocked: true,
      timeToBlockExpire: 30, // 30s
    });
  });
});
