import {
  Injectable,
  Logger,
  OnModuleInit,
  OnModuleDestroy,
} from '@nestjs/common';
import { SessionService } from './session.service';
import { AccountLockoutService } from './account-lockout.service';

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
  async runCleanup(): Promise<{ sessions: number; lockouts: number }> {
    const [sessions, lockouts] = await Promise.all([
      this.sessionService.purgeExpired(),
      this.accountLockoutService.purgeExpired(),
    ]);

    if (sessions > 0 || lockouts > 0) {
      this.logger.log(
        `Purged ${sessions} expired sessions, ${lockouts} expired lockout records`,
      );
    }

    return { sessions, lockouts };
  }
}
