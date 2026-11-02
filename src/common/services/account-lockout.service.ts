import { Injectable, Logger } from '@nestjs/common';
import { redisConnection } from '../../queue/redis';

const MAX_ATTEMPTS = 5;
const LOCKOUT_DURATION_SECONDS = 15 * 60; // 15 minutes
const ATTEMPT_WINDOW_SECONDS = 15 * 60; // 15 minutes

@Injectable()
export class AccountLockoutService {
  private readonly logger = new Logger(AccountLockoutService.name);

  private readonly LUA_LOCKOUT_SCRIPT = `
  local lockKey = KEYS[1]
  local attemptsKey = KEYS[2]
  local maxAttempts = tonumber(ARGV[1])
  local lockoutDuration = tonumber(ARGV[2])
  local attemptWindow = tonumber(ARGV[3])

  if redis.call("EXISTS", lockKey) == 1 then
    local ttl = redis.call("TTL", lockKey)
    return {1, ttl}
  end

  local attempts = redis.call("INCR", attemptsKey)
  if attempts == 1 then
    redis.call("EXPIRE", attemptsKey, attemptWindow)
  end

  if attempts >= maxAttempts then
    redis.call("SETEX", lockKey, lockoutDuration, "1")
    redis.call("DEL", attemptsKey)
    return {1, lockoutDuration}
  end

  return {0, attempts}
`;

  /**
   * Normalize identifier
   */
  private normalizeIdentifier(identifier: string): string {
    return identifier.toLowerCase().trim();
  }

  /**
   * Records a failed attempt and locks the account if MAX_ATTEMPTS is reached.
   */
  async recordFailedAttempt(identifier: string): Promise<{
    locked: boolean;
    remainingAttempts?: number;
    lockoutExpires?: number;
  }> {
    const normalized = this.normalizeIdentifier(identifier);
    const lockKey = `auth:lockout:locked:${normalized}`;
    const attemptsKey = `auth:lockout:attempts:${normalized}`;

    try {
      const result = (await redisConnection.eval(
        this.LUA_LOCKOUT_SCRIPT,
        2, // number of keys
        lockKey,
        attemptsKey,
        MAX_ATTEMPTS,
        LOCKOUT_DURATION_SECONDS,
        ATTEMPT_WINDOW_SECONDS,
      )) as [number, number];

      const isLocked = result[0] === 1;
      const val = result[1];

      if (isLocked) {
        return {
          locked: true,
          lockoutExpires: Date.now() + val * 1000,
        };
      }

      return {
        locked: false,
        remainingAttempts: Math.max(0, MAX_ATTEMPTS - val),
      };
    } catch (e) {
      this.logger.error(`Redis failure in recordFailedAttempt: ${e.message}`);
      // Fail closed: assume locked to prevent brute force if Redis is down
      throw new Error('Lockout service is currently unavailable');
    }
  }

  /**
   * Resets the failed attempts counter upon successful login.
   */
  async recordSuccessfulAttempt(identifier: string): Promise<void> {
    const normalized = this.normalizeIdentifier(identifier);
    try {
      await redisConnection.del(`auth:lockout:attempts:${normalized}`);
      await redisConnection.del(`auth:lockout:locked:${normalized}`);
    } catch (e) {
      this.logger.error(
        `Redis failure in recordSuccessfulAttempt: ${e.message}`,
      );
    }
  }

  /**
   * Checks if an account is currently locked.
   */
  async isLocked(
    identifier: string,
  ): Promise<{ locked: boolean; lockoutExpires?: number }> {
    const normalized = this.normalizeIdentifier(identifier);
    const lockKey = `auth:lockout:locked:${normalized}`;

    try {
      const isLocked = await redisConnection.exists(lockKey);

      if (!isLocked) {
        return { locked: false };
      }

      const ttl = await redisConnection.ttl(lockKey);
      return {
        locked: true,
        lockoutExpires: Date.now() + ttl * 1000,
      };
    } catch (e) {
      this.logger.error(`Redis failure in isLocked: ${e.message}`);
      // Fail closed
      return { locked: true };
    }
  }

  /**
   * Returns remaining lockout time in seconds.
   */
  async getLockoutRemainingTime(identifier: string): Promise<number> {
    const normalized = this.normalizeIdentifier(identifier);
    const lockKey = `auth:lockout:locked:${normalized}`;
    try {
      const ttl = await redisConnection.ttl(lockKey);
      return ttl > 0 ? ttl : 0;
    } catch (e) {
      this.logger.error(
        `Redis failure in getLockoutRemainingTime: ${e.message}`,
      );
      return LOCKOUT_DURATION_SECONDS; // Fail closed
    }
  }
}
