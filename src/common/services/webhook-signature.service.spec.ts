import { WebhookSignatureService } from './webhook-signature.service';

describe('WebhookSignatureService', () => {
  const prisma = {
    idempotencyKey: {
      findUnique: jest.fn(),
      create: jest.fn(),
      upsert: jest.fn(),
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('looks up webhook events using the composite namespace key', async () => {
    prisma.idempotencyKey.findUnique.mockResolvedValue(null);
    const service = new WebhookSignatureService(prisma as any);

    await service.isEventProcessed('evt_123');

    expect(prisma.idempotencyKey.findUnique).toHaveBeenCalledWith({
      where: {
        namespace_key: {
          namespace: 'paystack_webhook',
          key: 'evt_123',
        },
      },
    });
  });

  it('marks processed events with the composite namespace key', async () => {
    prisma.idempotencyKey.upsert.mockResolvedValue(undefined);
    const service = new WebhookSignatureService(prisma as any);

    await service.markEventProcessed('evt_456');

    expect(prisma.idempotencyKey.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          namespace_key: {
            namespace: 'paystack_webhook',
            key: 'evt_456',
          },
        },
      }),
    );
  });

  describe('verifyPaystackSignature', () => {
    it('returns false instead of crashing when signature has different length than hash', () => {
      const service = new WebhookSignatureService(prisma as any);
      const payload = 'test-payload';
      const secret = 'test-secret';
      const shortSignature = 'short';
      
      const isValid = service.verifyPaystackSignature(payload, shortSignature, secret);
      expect(isValid).toBe(false);
    });

    it('returns true for a valid signature and false for an invalid signature of the same length', () => {
      const service = new WebhookSignatureService(prisma as any);
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
      const service = new WebhookSignatureService(prisma as any);
      expect(() => service.verifyPaystackSignature('', 'sig', 'sec')).toThrow();
      expect(() => service.verifyPaystackSignature('pay', '', 'sec')).toThrow();
      expect(() => service.verifyPaystackSignature('pay', 'sig', '')).toThrow();
    });
  });
});
