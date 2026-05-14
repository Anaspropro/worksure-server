import {
  Injectable,
  Logger,
  OnModuleInit,
  OnModuleDestroy,
} from '@nestjs/common';
import { SessionService } from './session.service';
import { AccountLockoutService } from './account-lockout.service';
import { IdempotencyService } from './idempotency.service';

/**
 * Periodic reaper for expired ephemeral rows in PostgreSQL.
 *
 * PostgreSQL doesn't have native TTL like Redis, so we emulate it:
 *   1. Every read query filters with `WHERE expiresAt > NOW()` — expired
 *      rows are invisible to the application immediately.
 *   2. This service runs a background interval that DELETEs expired rows
 *      to reclaim disk space and keep indexes lean.
 *
 * The cleanup interval is intentionally long (5 minutes) because expired
 * rows are already invisible to queries. This is a space-reclamation
 * concern, not a correctness concern.
 */
@Injectable()
export class EphemeralCleanupService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(EphemeralCleanupService.name);
  private intervalHandle: ReturnType<typeof setInterval> | null = null;

  private static readonly CLEANUP_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

  constructor(
    private readonly sessionService: SessionService,
    private readonly accountLockoutService: AccountLockoutService,
    private readonly idempotencyService: IdempotencyService,
  ) {}

  onModuleInit() {
    this.logger.log(
      `Starting ephemeral cleanup every ${EphemeralCleanupService.CLEANUP_INTERVAL_MS / 1000}s`,
    );

    this.intervalHandle = setInterval(() => {
      this.runCleanup().catch((err) => {
        this.logger.error(`Cleanup cycle failed: ${err.message}`);
      });
    }, EphemeralCleanupService.CLEANUP_INTERVAL_MS);
  }

  onModuleDestroy() {
    if (this.intervalHandle) {
      clearInterval(this.intervalHandle);
      this.intervalHandle = null;
    }
  }

  /**
   * Execute a single cleanup cycle. Can also be called manually from
   * admin endpoints or health checks.
   */
  async runCleanup(): Promise<{ sessions: number; lockouts: number; locks: number }> {
    this.logger.log('Starting ephemeral cleanup cycle...');
    const startTime = Date.now();

    // Run sequentially to avoid simultaneous cold-start connection requests
    const sessions = await this.sessionService.purgeExpired();
    const lockouts = await this.accountLockoutService.purgeExpired();
    const locks = await this.idempotencyService.purgeExpired();

    const duration = Date.now() - startTime;

    if (sessions > 0 || lockouts > 0 || locks > 0) {
      this.logger.log(
        `Cleanup cycle complete (${duration}ms). Purged ${sessions} sessions, ${lockouts} lockout records, ${locks} stale locks`,
      );
    } else {
      this.logger.debug(`Cleanup cycle complete (${duration}ms). No records to purge.`);
    }

    return { sessions, lockouts, locks };
  }
}
