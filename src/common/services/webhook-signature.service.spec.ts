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
});
