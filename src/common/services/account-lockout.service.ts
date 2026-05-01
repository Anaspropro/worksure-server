import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

const MAX_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 15 * 60 * 1000; // 15 minutes
const ATTEMPT_WINDOW_MS = 15 * 60 * 1000; // 15 minutes

@Injectable()
export class AccountLockoutService {
  private readonly logger = new Logger(AccountLockoutService.name);

  constructor(private readonly prisma: PrismaService) {}

  async recordFailedAttempt(identifier: string): Promise<{
    locked: boolean;
    remainingAttempts?: number;
    lockoutExpires?: number;
  }> {
    const now = new Date();

    // Find existing non-expired lockout record
    const existing = await this.prisma.accountLockout.findFirst({
      where: {
        identifier,
        expiresAt: { gt: now },
      },
    });

    if (!existing) {
      // First failure — create a new lockout record
      const expiresAt = new Date(now.getTime() + ATTEMPT_WINDOW_MS);
      await this.prisma.accountLockout.upsert({
        where: { identifier },
        create: {
          identifier,
          attempts: 1,
          lastAttemptAt: now,
          expiresAt,
        },
        update: {
          attempts: 1,
          lastAttemptAt: now,
          lockedUntil: null,
          expiresAt,
        },
      });
      return { locked: false, remainingAttempts: MAX_ATTEMPTS - 1 };
    }

    // If currently locked and lock hasn't expired, reject
    if (existing.lockedUntil && now < existing.lockedUntil) {
      return {
        locked: true,
        lockoutExpires: existing.lockedUntil.getTime(),
      };
    }

    // If lock has expired but record exists, reset
    if (existing.lockedUntil && now >= existing.lockedUntil) {
      const expiresAt = new Date(now.getTime() + ATTEMPT_WINDOW_MS);
      await this.prisma.accountLockout.update({
        where: { id: existing.id },
        data: {
          attempts: 1,
          lastAttemptAt: now,
          lockedUntil: null,
          expiresAt,
        },
      });
      return { locked: false, remainingAttempts: MAX_ATTEMPTS - 1 };
    }

    // Increment failed attempts
    const newAttempts = existing.attempts + 1;

    if (newAttempts >= MAX_ATTEMPTS) {
      // Lock the account
      const lockedUntil = new Date(now.getTime() + LOCKOUT_DURATION_MS);
      await this.prisma.accountLockout.update({
        where: { id: existing.id },
        data: {
          attempts: newAttempts,
          lastAttemptAt: now,
          lockedUntil,
          expiresAt: lockedUntil, // Extend record lifetime to cover the lockout
        },
      });
      return {
        locked: true,
        lockoutExpires: lockedUntil.getTime(),
      };
    }

    // Not yet locked — just bump the counter
    await this.prisma.accountLockout.update({
      where: { id: existing.id },
      data: {
        attempts: newAttempts,
        lastAttemptAt: now,
      },
    });

    return {
      locked: false,
      remainingAttempts: MAX_ATTEMPTS - newAttempts,
    };
  }

  async recordSuccessfulAttempt(identifier: string): Promise<void> {
    await this.prisma.accountLockout.deleteMany({
      where: { identifier },
    });
  }

  async isLocked(
    identifier: string,
  ): Promise<{ locked: boolean; lockoutExpires?: number }> {
    const now = new Date();

    const record = await this.prisma.accountLockout.findFirst({
      where: {
        identifier,
        expiresAt: { gt: now },
        lockedUntil: { gt: now },
      },
    });

    if (!record) {
      return { locked: false };
    }

    return {
      locked: true,
      lockoutExpires: record.lockedUntil!.getTime(),
    };
  }

  async getLockoutRemainingTime(identifier: string): Promise<number> {
    const { locked, lockoutExpires } = await this.isLocked(identifier);
    if (!locked || !lockoutExpires) {
      return 0;
    }
    return Math.max(0, Math.ceil((lockoutExpires - Date.now()) / 1000));
  }

  /**
   * Delete all expired lockout records. Called by EphemeralCleanupService.
   */
  async purgeExpired(): Promise<number> {
    const result = await this.prisma.accountLockout.deleteMany({
      where: { expiresAt: { lte: new Date() } },
    });
    return result.count;
  }
}
