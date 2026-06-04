import { Injectable, BadRequestException } from '@nestjs/common';
import * as crypto from 'crypto';
import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class WebhookSignatureService {
  private readonly namespace = 'paystack_webhook';
  /**
   * Verify Paystack webhook signature
   * @param payload - Raw request body as string
   * @param signature - X-Paystack-Signature header
   * @param secret - Paystack secret key
   * @returns boolean - True if signature is valid
   */
  verifyPaystackSignature(
    payload: string,
    signature: string,
    secret: string,
  ): boolean {
    if (!payload || !signature || !secret) {
      throw new BadRequestException(
        'Missing required webhook verification parameters',
      );
    }

    // Paystack uses SHA-512 HMAC
    const hash = crypto
      .createHmac('sha512', secret)
      .update(payload, 'utf8')
      .digest('hex');

    const hashBuffer = Buffer.from(hash);
    const signatureBuffer = Buffer.from(signature);

    if (hashBuffer.length !== signatureBuffer.length) {
      return false;
    }

    // Use timing-safe comparison to prevent timing attacks
    return crypto.timingSafeEqual(hashBuffer, signatureBuffer);
  }

  /**
   * Extract and verify webhook from request
   * @param body - Request body
   * @param signature - Signature header
   * @param secret - Secret key
   * @returns Parsed and verified payload
   */
  verifyAndParseWebhook<T = any>(
    body: string | object,
    signature: string,
    secret: string,
  ): T {
    const payloadString =
      typeof body === 'string' ? body : JSON.stringify(body);

    if (!this.verifyPaystackSignature(payloadString, signature, secret)) {
      throw new BadRequestException('Invalid webhook signature');
    }

    return typeof body === 'string'
      ? (JSON.parse(body) as T)
      : (body as unknown as T);
  }

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Check if webhook event has been processed (idempotency)
   * @param eventId - Paystack event ID
   * @returns Promise<boolean> - True if already processed
   */
  async isEventProcessed(eventId: string): Promise<boolean> {
    const existing = await this.prisma.idempotencyKey.findUnique({
      where: {
        namespace_key: {
          namespace: this.namespace,
          key: eventId,
        },
      },
    });

    if (existing) {
      if (!existing.completedAt) {
        // It might be locked by an active process.
        // For a strict fintech app we should throw or wait,
        // but returning true rejects the concurrent paystack webhook safely.
        return true;
      }
      return true;
    }

    return false;
  }

  /**
   * Attempt to lock an incoming webhook event for processing.
   * Returns false when another worker/request already owns or completed it.
   */
  async tryBeginEventProcessing(eventId: string): Promise<boolean> {
    try {
      await this.prisma.idempotencyKey.create({
        data: {
          key: eventId,
          namespace: this.namespace,
          lockedAt: new Date(),
        },
      });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Mark webhook event as processed
   * @param eventId - Paystack event ID
   * @returns Promise<void>
   */
  async markEventProcessed(eventId: string): Promise<void> {
    await this.prisma.idempotencyKey.upsert({
      where: {
        namespace_key: {
          namespace: this.namespace,
          key: eventId,
        },
      },
      update: {
        completedAt: new Date(),
      },
      create: {
        key: eventId,
        namespace: this.namespace,
        lockedAt: new Date(),
        completedAt: new Date(),
      },
    });
  }
}
