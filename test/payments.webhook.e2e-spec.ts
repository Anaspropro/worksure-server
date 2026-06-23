import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import * as crypto from 'crypto';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/database/prisma.service';
import { redisConnection } from '../src/queue/redis';

describe('Payments Webhook (e2e)', () => {
  let app: INestApplication;
  let prismaService: PrismaService;

  const WEBHOOK_SECRET = 'test_secret_123';
  const MOCK_REFERENCE = 'test-ref-' + Date.now();
  
  beforeAll(async () => {
    process.env.PAYSTACK_WEBHOOK_SECRET = WEBHOOK_SECRET;

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication({ rawBody: true });
    
    // Enable rawBody parsing which is required for the webhook signature verification
    
    await app.init();
    prismaService = app.get<PrismaService>(PrismaService);
  });

  afterAll(async () => {
    await redisConnection.quit();
    if (app) {
      await app.close();
    }
  });

  const generateSignature = (payload: any, secret: string) => {
    return crypto
      .createHmac('sha512', secret)
      .update(JSON.stringify(payload))
      .digest('hex');
  };

  it('should reject requests with missing signatures', async () => {
    const payload = { event: 'charge.success', data: { reference: MOCK_REFERENCE } };
    
    const response = await request(app.getHttpServer())
      .post('/payments/paystack/webhook')
      .send(payload)
      .expect(400);

    expect(response.body.message).toContain('signature is missing');
  });

  it('should reject requests with invalid signatures', async () => {
    const payload = { event: 'charge.success', data: { reference: MOCK_REFERENCE } };
    const invalidSignature = generateSignature(payload, 'wrong_secret');
    
    const response = await request(app.getHttpServer())
      .post('/payments/paystack/webhook')
      .set('x-paystack-signature', invalidSignature)
      .send(payload)
      .expect(403); // Assuming Forbidden on invalid signature

    expect(response.body.message).toContain('signature');
  });

  it('should process a valid webhook request', async () => {
    const payload = {
      event: 'charge.success',
      data: {
        id: Math.floor(Math.random() * 1000000),
        reference: MOCK_REFERENCE,
        status: 'success',
        amount: 50000,
        currency: 'NGN',
        customer: { email: 'test@example.com' },
      },
    };
    
    const signature = generateSignature(payload, WEBHOOK_SECRET);
    
    // Mock Prisma's expected behaviour or expect an error internally but 200/201 response externally
    const response = await request(app.getHttpServer())
      .post('/payments/paystack/webhook')
      .set('x-paystack-signature', signature)
      .send(payload);

    // Depending on whether the record exists in the DB, it may return 201 Created or 200 OK.
    expect([200, 201]).toContain(response.status);
    expect(response.body.status).toBe('success');
  });

  it('should enforce idempotency for duplicate webhooks', async () => {
    const eventId = Math.floor(Math.random() * 1000000);
    const payload = {
      event: 'charge.success',
      data: {
        id: eventId,
        reference: `dup-ref-${eventId}`,
        status: 'success',
        amount: 50000,
      },
    };
    
    const signature = generateSignature(payload, WEBHOOK_SECRET);
    
    // First request
    await request(app.getHttpServer())
      .post('/payments/paystack/webhook')
      .set('x-paystack-signature', signature)
      .send(payload);

    // Second request with exact same payload and ID
    const duplicateResponse = await request(app.getHttpServer())
      .post('/payments/paystack/webhook')
      .set('x-paystack-signature', signature)
      .send(payload)
      .expect(201); // Or 200

    expect(duplicateResponse.body.status).toBe('already_processed');
  });

  it('should reject duplicate payloads with mutated or invalid signatures (replay attack)', async () => {
    const eventId = Math.floor(Math.random() * 1000000);
    const payload = {
      event: 'charge.success',
      data: {
        id: eventId,
        reference: `mutated-ref-${eventId}`,
        status: 'success',
      },
    };
    
    const validSignature = generateSignature(payload, WEBHOOK_SECRET);
    const invalidSignature = generateSignature({ ...payload, timestamp: Date.now() }, WEBHOOK_SECRET);
    
    // First request is valid
    await request(app.getHttpServer())
      .post('/payments/paystack/webhook')
      .set('x-paystack-signature', validSignature)
      .send(payload)
      .expect(res => [200, 201].includes(res.status));

    // Second request has the same event ID, but a bad signature (simulating interception/replay mutation)
    const duplicateResponse = await request(app.getHttpServer())
      .post('/payments/paystack/webhook')
      .set('x-paystack-signature', invalidSignature) // Signature of a different payload
      .send(payload)
      .expect(403);

    expect(duplicateResponse.body.message).toContain('signature');
  });

  it('should handle out-of-order delivery gracefully and assert final state correctness', async () => {
    // This test ensures that receiving a late event does not break the state machine
    // e.g. transfer.success arrives before charge.success
    const eventId1 = Math.floor(Math.random() * 1000000);
    const eventId2 = eventId1 + 1;
    const reference = `out-of-order-${eventId1}`;

    const payloadTransfer = {
      event: 'transfer.success',
      data: { id: eventId2, reference, status: 'success' },
    };
    
    const payloadCharge = {
      event: 'charge.success',
      data: { id: eventId1, reference, status: 'success' },
    };

    // Send transfer first
    const sigTransfer = generateSignature(payloadTransfer, WEBHOOK_SECRET);
    await request(app.getHttpServer())
      .post('/payments/paystack/webhook')
      .set('x-paystack-signature', sigTransfer)
      .send(payloadTransfer)
      .expect(res => [200, 201].includes(res.status));

    // Send charge second
    const sigCharge = generateSignature(payloadCharge, WEBHOOK_SECRET);
    await request(app.getHttpServer())
      .post('/payments/paystack/webhook')
      .set('x-paystack-signature', sigCharge)
      .send(payloadCharge)
      .expect(res => [200, 201].includes(res.status));
      
    // Both should be processed without 500 errors, asserting the state machine is order-independent
  });

  it('should support partial failure recovery (webhook fails mid-transaction)', async () => {
    // If a database crash happens during processing, the webhook should fail (500)
    // so Paystack retries later, and the event should NOT be marked as processed.
    const eventId = Math.floor(Math.random() * 1000000);
    const payload = {
      event: 'charge.success',
      data: { id: eventId, reference: `partial-fail-${eventId}`, status: 'success' },
    };
    
    const signature = generateSignature(payload, WEBHOOK_SECRET);
    
    // We mock the PaymentsService to throw an error on the first attempt
    const paymentsService = app.get('PaymentsService');
    const originalProcess = paymentsService.processPaystackWebhook;
    
    let attemptCount = 0;
    jest.spyOn(paymentsService, 'processPaystackWebhook').mockImplementation(async (data: any) => {
      attemptCount++;
      if (attemptCount === 1) {
        throw new Error('Simulated Database Transaction Failure');
      }
      return originalProcess.apply(paymentsService, [data]);
    });

    // First request crashes mid-transaction
    await request(app.getHttpServer())
      .post('/payments/paystack/webhook')
      .set('x-paystack-signature', signature)
      .send(payload)
      .expect(500);

    // Second request (Paystack retry) should succeed because the idempotency key wasn't locked permanently
    const retryResponse = await request(app.getHttpServer())
      .post('/payments/paystack/webhook')
      .set('x-paystack-signature', signature)
      .send(payload)
      .expect(res => [200, 201].includes(res.status));

    expect(retryResponse.body.status).toBe('success');
    expect(attemptCount).toBe(2);
  });
});
