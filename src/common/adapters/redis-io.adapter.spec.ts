import { RedisIoAdapter } from './redis-io.adapter';
import { INestApplication } from '@nestjs/common';
import Redis from 'ioredis';

jest.mock('ioredis', () => {
  const mRedis = jest.fn().mockImplementation(() => {
    return {
      duplicate: jest.fn().mockReturnValue({}),
      on: jest.fn(),
    };
  });
  return {
    default: mRedis,
    __esModule: true,
  };
});

// Helper to access the mock
const MockRedis = require('ioredis').default;

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
    process.env.REDIS_URL = 'redis://localhost:6379';
  });

  afterEach(() => {
    delete process.env.REDIS_URL;
  });

  it('should be defined', () => {
    expect(adapter).toBeDefined();
  });

  it('should successfully connect to Redis and initialize the adapter constructor', async () => {
    await expect(adapter.connectToRedis()).resolves.toBeUndefined();
    expect(MockRedis).toHaveBeenCalledWith(
      'redis://localhost:6379',
      expect.objectContaining({
        tls: {
          rejectUnauthorized: false,
        },
      }),
    );
  });

  it('should throw error when REDIS_URL is missing', async () => {
    delete process.env.REDIS_URL;
    await expect(adapter.connectToRedis()).rejects.toThrow('REDIS_URL environment variable is missing');
  });
});
