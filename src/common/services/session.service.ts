import { Injectable, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { v7 as uuidv7 } from 'uuid';
import { PrismaService } from '../../database/prisma.service';

export interface SessionData {
  userId: string;
  email: string;
  role: string;
  loginTime: number;
  lastActivity: number;
  ipAddress: string;
  userAgent: string;
  sessionId: string;
}

const SESSION_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
const SESSION_DB_SYNC_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

class SimpleLRUCache<K, V> {
  private cache = new Map<K, V>();
  constructor(private readonly maxKeys: number) {}

  get(key: K): V | undefined {
    const item = this.cache.get(key);
    if (item) {
      this.cache.delete(key);
      this.cache.set(key, item);
    }
    return item;
  }

  set(key: K, val: V) {
    if (this.cache.has(key)) {
      this.cache.delete(key);
    } else if (this.cache.size >= this.maxKeys) {
      this.cache.delete(this.cache.keys().next().value);
    }
    this.cache.set(key, val);
  }

  delete(key: K) {
    this.cache.delete(key);
  }

  clear() {
    this.cache.clear();
  }

  values() {
    return Array.from(this.cache.values());
  }
}

@Injectable()
export class SessionService {
  private readonly logger = new Logger(SessionService.name);
  private readonly sessionCache = new SimpleLRUCache<
    string,
    { data: SessionData; lastDbSync: number }
  >(5000);

  constructor(
    private readonly jwtService: JwtService,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * Create a new session for authenticated user.
   * Session is stored in PostgreSQL with an expiresAt timestamp —
   * expired rows are filtered out by every read query and reaped
   * periodically by EphemeralCleanupService.
   */
  async createSession(
    userId: string,
    email: string,
    role: string,
    ipAddress: string,
    userAgent: string,
  ): Promise<string> {
    const now = new Date();
    const expiresAt = new Date(now.getTime() + SESSION_TTL_MS);

    const session = await this.prisma.session.create({
      data: {
        id: uuidv7(),
        userId,
        email,
        role,
        ipAddress,
        userAgent: this.sanitizeUserAgent(userAgent),
        loginTime: now,
        lastActivity: now,
        expiresAt,
      },
    });

    this.sessionCache.set(session.id, {
      data: this.toSessionData(session),
      lastDbSync: now.getTime(),
    });

    return session.id;
  }

  /**
   * Validate and get session data.
   * Returns null for expired or missing sessions.
   * Slides the expiry window on every successful validation.
   */
  async validateSession(sessionId: string): Promise<SessionData | null> {
    const now = new Date();
    const nowMs = now.getTime();

    let cached = this.sessionCache.get(sessionId);

    // If cached, check if it has expired in memory
    if (cached) {
      if (nowMs >= cached.data.lastActivity + SESSION_TTL_MS) {
        this.sessionCache.delete(sessionId);
        cached = undefined;
      }
    }

    if (!cached) {
      const session = await this.prisma.session.findFirst({
        where: {
          id: sessionId,
          expiresAt: { gt: now },
        },
      });

      if (!session) {
        return null;
      }

      cached = {
        data: this.toSessionData(session),
        lastDbSync: session.lastActivity.getTime(),
      };
      this.sessionCache.set(sessionId, cached);
    }

    cached.data.lastActivity = nowMs;

    // Throttle DB updates to avoid writing on every request
    if (nowMs - cached.lastDbSync > SESSION_DB_SYNC_INTERVAL_MS) {
      cached.lastDbSync = nowMs;
      const newExpiresAt = new Date(nowMs + SESSION_TTL_MS);

      this.prisma.session
        .update({
          where: { id: sessionId },
          data: {
            lastActivity: now,
            expiresAt: newExpiresAt,
          },
        })
        .catch((e) =>
          this.logger.error(`Failed to slide session expiry: ${e.message}`),
        );
    }

    return cached.data;
  }

  /**
   * Invalidate a specific session (logout)
   */
  async invalidateSession(sessionId: string): Promise<boolean> {
    this.sessionCache.delete(sessionId);
    const result = await this.prisma.session.deleteMany({
      where: { id: sessionId },
    });
    return result.count > 0;
  }

  /**
   * Invalidate all sessions for a user (password reset, force-logout)
   */
  async invalidateUserSessions(userId: string): Promise<number> {
    // Remove all cached sessions for this user
    const entries = this.sessionCache.values();
    for (const entry of entries) {
      if (entry.data.userId === userId) {
        this.sessionCache.delete(entry.data.sessionId);
      }
    }

    const result = await this.prisma.session.deleteMany({
      where: { userId },
    });
    return result.count;
  }

  /**
   * Get all active (non-expired) sessions for a user
   */
  async getUserSessions(userId: string): Promise<SessionData[]> {
    const sessions = await this.prisma.session.findMany({
      where: {
        userId,
        expiresAt: { gt: new Date() },
      },
      orderBy: { lastActivity: 'desc' },
    });

    return sessions.map((s) => this.toSessionData(s));
  }

  /**
   * Get session statistics
   */
  async getSessionStats(): Promise<{
    totalSessions: number;
    activeSessions: number;
    expiredSessions: number;
  }> {
    const now = new Date();

    const [active, expired] = await Promise.all([
      this.prisma.session.count({
        where: { expiresAt: { gt: now } },
      }),
      this.prisma.session.count({
        where: { expiresAt: { lte: now } },
      }),
    ]);

    return {
      totalSessions: active + expired,
      activeSessions: active,
      expiredSessions: expired,
    };
  }

  /**
   * Check for suspicious activity
   */
  async detectSuspiciousActivity(userId: string): Promise<{
    isSuspicious: boolean;
    reasons: string[];
  }> {
    const userSessions = await this.getUserSessions(userId);
    const reasons: string[] = [];

    // Multiple concurrent sessions from different IPs
    const uniqueIPs = new Set(userSessions.map((s) => s.ipAddress));
    if (uniqueIPs.size > 2) {
      reasons.push('Multiple concurrent sessions from different IP addresses');
    }

    // Sessions from multiple countries (basic IP check)
    const ipRanges = userSessions.map((s) => this.getIPRange(s.ipAddress));
    const uniqueRanges = new Set(ipRanges);
    if (uniqueRanges.size > 1) {
      reasons.push('Sessions from different geographic regions');
    }

    // Rapid session creation
    const fiveMinAgo = Date.now() - 5 * 60 * 1000;
    const recentSessions = userSessions.filter((s) => s.loginTime > fiveMinAgo);
    if (recentSessions.length > 3) {
      reasons.push('Rapid session creation detected');
    }

    return {
      isSuspicious: reasons.length > 0,
      reasons,
    };
  }

  /**
   * Create JWT token with session ID
   */
  createSessionToken(sessionData: SessionData): string {
    return this.jwtService.sign({
      sub: sessionData.userId,
      email: sessionData.email,
      role: sessionData.role,
      sessionId: sessionData.sessionId,
    });
  }

  /**
   * Verify JWT token and extract session ID
   */
  verifyToken(token: string): {
    valid: boolean;
    sessionId?: string;
    payload?: Record<string, unknown>;
  } {
    try {
      const payload = this.jwtService.verify<Record<string, unknown>>(token);
      const sessionId =
        typeof payload.sessionId === 'string' ? payload.sessionId : undefined;
      return {
        valid: true,
        sessionId,
        payload,
      };
    } catch {
      return { valid: false };
    }
  }

  /**
   * Delete all expired sessions. Called by EphemeralCleanupService.
   */
  async purgeExpired(): Promise<number> {
    const result = await this.prisma.session.deleteMany({
      where: { expiresAt: { lte: new Date() } },
    });
    return result.count;
  }

  // ─── Private helpers ───────────────────────────────────────

  private toSessionData(session: {
    id: string;
    userId: string;
    email: string;
    role: string;
    ipAddress: string;
    userAgent: string;
    loginTime: Date;
    lastActivity: Date;
  }): SessionData {
    return {
      sessionId: session.id,
      userId: session.userId,
      email: session.email,
      role: session.role,
      ipAddress: session.ipAddress,
      userAgent: session.userAgent,
      loginTime: session.loginTime.getTime(),
      lastActivity: session.lastActivity.getTime(),
    };
  }

  private generateSessionId(): string {
    return uuidv7();
  }

  private sanitizeUserAgent(userAgent: string): string {
    if (!userAgent) {
      return 'Unknown';
    }

    return userAgent
      .substring(0, 500) // Limit length
      .replace(/[<>]/g, '') // Remove potential XSS
      .trim();
  }

  private getIPRange(ip: string): string {
    if (!ip) {
      return 'unknown';
    }

    // Simple IP range classification (first two octets for IPv4)
    const parts = ip.split('.');
    if (parts.length >= 2) {
      return `${parts[0]}.${parts[1]}`;
    }

    // For IPv6, return first segment
    const ipv6Parts = ip.split(':');
    if (ipv6Parts.length >= 1) {
      return ipv6Parts[0];
    }

    return 'unknown';
  }
}
