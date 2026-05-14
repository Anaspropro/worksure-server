import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

/**
 * Shared idempotency lock service.
 *
 * Provides acquire/complete/release semantics for operation-level locking
 * using the IdempotencyKey table with composite (namespace, key) uniqueness.
 *
 * Previously duplicated across ContractsService and PaymentsService —
 * now consolidated here for reuse.
 */
@Injectable()
export class IdempotencyService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Attempt to acquire an idempotency lock for the given key and namespace.
   * Returns true if the lock was successfully acquired, false if the key already exists.
   */
  async tryAcquire(key: string, namespace: string): Promise<boolean> {
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
    try {
      await this.prisma.idempotencyKey.create({
        data: {
          key,
          namespace,
          lockedAt: new Date(),
          expiresAt,
        },
      });
      return true;
    } catch {
      // If it exists, check if it's expired and try to reclaim
      const result = await this.prisma.idempotencyKey.updateMany({
        where: {
          namespace,
          key,
          completedAt: null,
          expiresAt: { lt: new Date() },
        },
        data: {
          lockedAt: new Date(),
          expiresAt,
        },
      });
      return result.count > 0;
    }
  }

  /**
   * Mark the operation as successfully completed.
   */
  async complete(key: string, namespace: string): Promise<void> {
    await this.prisma.idempotencyKey.update({
      where: {
        namespace_key: {
          namespace,
          key,
        },
      },
      data: {
        completedAt: new Date(),
      },
    });
  }

  /**
   * Release the lock on failure so the operation can be retried.
   */
  async release(key: string, namespace: string): Promise<void> {
    await this.prisma.idempotencyKey.delete({
      where: {
        namespace_key: {
          namespace,
          key,
        },
      },
    });
  }

  /**
   * Delete expired and stale idempotency keys
   */
  async purgeExpired(): Promise<number> {
    const staleResult = await this.prisma.idempotencyKey.deleteMany({
      where: {
        expiresAt: { lt: new Date() },
        completedAt: null,
      },
    });
    
    const oldDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const oldResult = await this.prisma.idempotencyKey.deleteMany({
      where: {
        completedAt: { lt: oldDate },
      },
    });

    return staleResult.count + oldResult.count;
  }
}
