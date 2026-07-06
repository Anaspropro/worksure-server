import { WebhookSignatureService } from './webhook-signature.service';
import { redisConnection } from '../../queue/redis';

// Mock the Redis connection module
jest.mock('../../queue/redis', () => ({
  redisConnection: {
    exists: jest.fn(),
    set: jest.fn(),
  },
}));

describe('WebhookSignatureService', () => {
  let service: WebhookSignatureService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new WebhookSignatureService();
  });

  it('looks up webhook events using the composite namespace key in Redis', async () => {
    (redisConnection.exists as jest.Mock).mockResolvedValue(1);

    const result = await service.isEventProcessed('evt_123');

    expect(result).toBe(true);
    expect(redisConnection.exists).toHaveBeenCalledWith('idempotency:paystack_webhook:evt_123');
  });

  it('locks events for processing using Redis SET NX', async () => {
    (redisConnection.set as jest.Mock).mockResolvedValue('OK');

    const result = await service.tryBeginEventProcessing('evt_789');

    expect(result).toBe(true);
    expect(redisConnection.set).toHaveBeenCalledWith(
      'idempotency:paystack_webhook:evt_789',
      'processing',
      'PX',
      10 * 60 * 1000,
      'NX',
    );
  });

  it('marks processed events with the composite namespace key in Redis', async () => {
    (redisConnection.set as jest.Mock).mockResolvedValue('OK');

    await service.markEventProcessed('evt_456');

    expect(redisConnection.set).toHaveBeenCalledWith(
      'idempotency:paystack_webhook:evt_456',
      'completed',
      'PX',
      7 * 24 * 60 * 60 * 1000,
    );
  });

  describe('verifyPaystackSignature', () => {
    it('returns false instead of crashing when signature has different length than hash', () => {
      const payload = 'test-payload';
      const secret = 'test-secret';
      const shortSignature = 'short';
      
      const isValid = service.verifyPaystackSignature(payload, shortSignature, secret);
      expect(isValid).toBe(false);
    });

    it('returns true for a valid signature and false for an invalid signature of the same length', () => {
      const payload = 'test-payload';
      const secret = 'test-secret';
      const hash = require('crypto')
        .createHmac('sha512', secret)
        .update(payload)
        .digest('hex');
      
      expect(service.verifyPaystackSignature(payload, hash, secret)).toBe(true);
      expect(service.verifyPaystackSignature(payload, hash.replace('a', 'b'), secret)).toBe(false);
    });

    it('throws BadRequestException if missing parameters', () => {
      expect(() => service.verifyPaystackSignature('', 'sig', 'sec')).toThrow();
      expect(() => service.verifyPaystackSignature('pay', '', 'sec')).toThrow();
      expect(() => service.verifyPaystackSignature('pay', 'sig', '')).toThrow();
    });
  });
});
