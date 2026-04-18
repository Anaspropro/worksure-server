import { Injectable } from '@nestjs/common';

export interface LoginAttempt {
  count: number;
  lastAttempt: number;
  lockUntil?: number;
}

@Injectable()
export class AccountLockoutService {
  private readonly attempts = new Map<string, LoginAttempt>();
  private readonly maxAttempts = 5;
  private readonly lockoutDuration = 15 * 60 * 1000; // 15 minutes
  private readonly attemptWindow = 15 * 60 * 1000; // 15 minutes

  recordFailedAttempt(identifier: string): {
    locked: boolean;
    remainingAttempts?: number;
    lockoutExpires?: number;
  } {
    const now = Date.now();
    const existing = this.attempts.get(identifier);

    if (!existing) {
      this.attempts.set(identifier, {
        count: 1,
        lastAttempt: now,
      });
      return { locked: false, remainingAttempts: this.maxAttempts - 1 };
    }

    // Reset if lockout period has passed
    if (existing.lockUntil && now > existing.lockUntil) {
      this.attempts.set(identifier, {
        count: 1,
        lastAttempt: now,
      });
      return { locked: false, remainingAttempts: this.maxAttempts - 1 };
    }

    // Reset if attempt window has passed
    if (now - existing.lastAttempt > this.attemptWindow) {
      this.attempts.set(identifier, {
        count: 1,
        lastAttempt: now,
      });
      return { locked: false, remainingAttempts: this.maxAttempts - 1 };
    }

    // Increment failed attempts
    existing.count++;
    existing.lastAttempt = now;

    // Check if should be locked
    if (existing.count >= this.maxAttempts) {
      existing.lockUntil = now + this.lockoutDuration;
      return {
        locked: true,
        lockoutExpires: existing.lockUntil,
      };
    }

    return {
      locked: false,
      remainingAttempts: this.maxAttempts - existing.count,
    };
  }

  recordSuccessfulAttempt(identifier: string): void {
    this.attempts.delete(identifier);
  }

  isLocked(identifier: string): { locked: boolean; lockoutExpires?: number } {
    const attempt = this.attempts.get(identifier);
    if (!attempt?.lockUntil) {
      return { locked: false };
    }

    const now = Date.now();
    if (now > attempt.lockUntil) {
      this.attempts.delete(identifier);
      return { locked: false };
    }

    return {
      locked: true,
      lockoutExpires: attempt.lockUntil,
    };
  }

  getLockoutRemainingTime(identifier: string): number {
    const { locked, lockoutExpires } = this.isLocked(identifier);
    if (!locked || !lockoutExpires) {
      return 0;
    }
    return Math.max(0, Math.ceil((lockoutExpires - Date.now()) / 1000));
  }

  // Cleanup expired entries periodically
  cleanup(): void {
    const now = Date.now();
    for (const [key, attempt] of this.attempts.entries()) {
      if (attempt.lockUntil && now > attempt.lockUntil) {
        this.attempts.delete(key);
      } else if (now - attempt.lastAttempt > this.attemptWindow) {
        this.attempts.delete(key);
      }
    }
  }
}
