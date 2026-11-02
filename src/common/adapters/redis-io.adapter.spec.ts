import { RedisIoAdapter } from './redis-io.adapter';
import { INestApplication } from '@nestjs/common';
import { createAdapter } from '@socket.io/redis-adapter';
import { redisConnection } from '../../queue/redis';

jest.mock('../../queue/redis', () => ({
  redisConnection: {
    duplicate: jest.fn().mockReturnValue({
      on: jest.fn(),
    }),
  },
}));

jest.mock('@socket.io/redis-adapter', () => ({
  createAdapter: jest.fn().mockReturnValue(jest.fn()),
}));

describe('RedisIoAdapter', () => {
  let adapter: RedisIoAdapter;
  let mockApp: Partial<INestApplication>;

  beforeEach(() => {
    mockApp = {
      get: jest.fn(),
    };
    adapter = new RedisIoAdapter(mockApp as INestApplication);
  });

  it('should be defined', () => {
    expect(adapter).toBeDefined();
  });

  it('should successfully connect to Redis and initialize the adapter constructor', async () => {
    await expect(adapter.connectToRedis()).resolves.toBeUndefined();
    expect(redisConnection.duplicate).toHaveBeenCalledTimes(2);
    expect(createAdapter).toHaveBeenCalled();
  });
});
