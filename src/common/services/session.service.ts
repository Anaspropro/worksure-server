import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { randomUUID } from 'node:crypto';

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

@Injectable()
export class SessionService {
  private readonly sessions = new Map<string, SessionData>();
  private readonly sessionTimeout = 24 * 60 * 60 * 1000; // 24 hours
  private readonly cleanupInterval = 60 * 60 * 1000; // 1 hour

  constructor(private readonly jwtService: JwtService) {
    // Start cleanup interval
    setInterval(() => this.cleanupExpiredSessions(), this.cleanupInterval);
  }

  /**
   * Create a new session for authenticated user
   */
  createSession(
    userId: string,
    email: string,
    role: string,
    ipAddress: string,
    userAgent: string,
  ): string {
    const sessionId = this.generateSessionId();
    const now = Date.now();

    const sessionData: SessionData = {
      userId,
      email,
      role,
      loginTime: now,
      lastActivity: now,
      ipAddress,
      userAgent: this.sanitizeUserAgent(userAgent),
      sessionId,
    };

    this.sessions.set(sessionId, sessionData);
    return sessionId;
  }

  /**
   * Validate and get session data
   */
  validateSession(sessionId: string): SessionData | null {
    const session = this.sessions.get(sessionId);

    if (!session) {
      return null;
    }

    // Check if session has expired
    if (Date.now() - session.lastActivity > this.sessionTimeout) {
      this.sessions.delete(sessionId);
      return null;
    }

    // Update last activity
    session.lastActivity = Date.now();
    return session;
  }

  /**
   * Invalidate a specific session
   */
  invalidateSession(sessionId: string): boolean {
    return this.sessions.delete(sessionId);
  }

  /**
   * Invalidate all sessions for a user
   */
  invalidateUserSessions(userId: string): number {
    let count = 0;
    for (const [sessionId, session] of this.sessions.entries()) {
      if (session.userId === userId) {
        this.sessions.delete(sessionId);
        count++;
      }
    }
    return count;
  }

  /**
   * Get all active sessions for a user
   */
  getUserSessions(userId: string): SessionData[] {
    const userSessions: SessionData[] = [];
    const now = Date.now();

    for (const session of this.sessions.values()) {
      if (
        session.userId === userId &&
        now - session.lastActivity <= this.sessionTimeout
      ) {
        userSessions.push(session);
      }
    }

    return userSessions;
  }

  /**
   * Get session statistics
   */
  getSessionStats(): {
    totalSessions: number;
    activeSessions: number;
    expiredSessions: number;
  } {
    const now = Date.now();
    let activeSessions = 0;
    let expiredSessions = 0;

    for (const session of this.sessions.values()) {
      if (now - session.lastActivity <= this.sessionTimeout) {
        activeSessions++;
      } else {
        expiredSessions++;
      }
    }

    return {
      totalSessions: this.sessions.size,
      activeSessions,
      expiredSessions,
    };
  }

  /**
   * Check for suspicious activity
   */
  detectSuspiciousActivity(userId: string): {
    isSuspicious: boolean;
    reasons: string[];
  } {
    const userSessions = this.getUserSessions(userId);
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
    const recentSessions = userSessions.filter(
      (s) => Date.now() - s.loginTime < 5 * 60 * 1000,
    );
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
   * Cleanup expired sessions
   */
  private cleanupExpiredSessions(): void {
    const now = Date.now();
    let cleanedCount = 0;

    for (const [sessionId, session] of this.sessions.entries()) {
      if (now - session.lastActivity > this.sessionTimeout) {
        this.sessions.delete(sessionId);
        cleanedCount++;
      }
    }

    if (cleanedCount > 0) {
      console.log(`Cleaned up ${cleanedCount} expired sessions`);
    }
  }

  /**
   * Generate secure session ID
   */
  private generateSessionId(): string {
    return randomUUID();
  }

  /**
   * Sanitize user agent for storage
   */
  private sanitizeUserAgent(userAgent: string): string {
    if (!userAgent) {
      return 'Unknown';
    }

    return userAgent
      .substring(0, 500) // Limit length
      .replace(/[<>]/g, '') // Remove potential XSS
      .trim();
  }

  /**
   * Get IP range for geographic checking (simplified)
   */
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
