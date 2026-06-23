import { Injectable, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { v7 as uuidv7 } from 'uuid';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { redisConnection } from '../../queue/redis';

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

const SESSION_TTL_SECONDS = 24 * 60 * 60; // 24 hours in seconds

@Injectable()
export class SessionService {
  private readonly logger = new Logger(SessionService.name);

  constructor(
    private readonly jwtService: JwtService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  /**
   * Create a new session for authenticated user in Redis.
   */
  async createSession(
    userId: string,
    email: string,
    role: string,
    ipAddress: string,
    userAgent: string,
  ): Promise<string> {
    const sessionId = uuidv7();
    const now = Date.now();

    const sessionData: SessionData = {
      sessionId,
      userId,
      email,
      role,
      ipAddress,
      userAgent: userAgent ? userAgent.substring(0, 255) : 'unknown',
      loginTime: now,
      lastActivity: now,
    };

    try {
      // Use a pipeline to ensure atomic creation of session and user-session mapping
      const pipeline = redisConnection.pipeline();
      
      // Store the session data
      pipeline.setex(`auth:session:${sessionId}`, SESSION_TTL_SECONDS, JSON.stringify(sessionData));
      
      // Add sessionId to the user's active sessions set
      pipeline.sadd(`auth:user_sessions:${userId}`, sessionId);
      // Ensure the set expires eventually to prevent orphaned data if a session isn't cleanly removed
      pipeline.expire(`auth:user_sessions:${userId}`, SESSION_TTL_SECONDS);

      await pipeline.exec();

      // Emit domain event
      this.eventEmitter.emit('session.created', sessionData);
      
      // Observability layer
      this.logger.log({ event: 'session.created', userId, sessionId, ipAddress });
      
      return sessionId;
    } catch (e) {
      this.logger.error(`Redis failure in createSession: ${e.message}`);
      // Fail closed
      throw new Error('Authentication service is currently unavailable');
    }
  }

  /**
   * Validate and get session data from Redis.
   * Slides the expiry window on successful validation.
   */
  async validateSession(sessionId: string): Promise<SessionData | null> {
    try {
      const sessionStr = await redisConnection.get(`auth:session:${sessionId}`);
      
      if (!sessionStr) {
        return null; // Session expired or does not exist
      }

      const sessionData: SessionData = JSON.parse(sessionStr);
      sessionData.lastActivity = Date.now();

      // Slide the session expiry
      const pipeline = redisConnection.pipeline();
      pipeline.setex(`auth:session:${sessionId}`, SESSION_TTL_SECONDS, JSON.stringify(sessionData));
      pipeline.expire(`auth:user_sessions:${sessionData.userId}`, SESSION_TTL_SECONDS);
      await pipeline.exec();

      return sessionData;
    } catch (error) {
      this.logger.error(`Redis failure or parsing error in validateSession: ${error.message}`);
      // Fail closed
      return null;
    }
  }

  /**
   * Invalidate a specific session (logout)
   */
  async invalidateSession(sessionId: string): Promise<boolean> {
    try {
      const sessionStr = await redisConnection.get(`auth:session:${sessionId}`);
      if (!sessionStr) return false;

      const sessionData: SessionData = JSON.parse(sessionStr);
      const pipeline = redisConnection.pipeline();
      pipeline.del(`auth:session:${sessionId}`);
      pipeline.srem(`auth:user_sessions:${sessionData.userId}`, sessionId);
      await pipeline.exec();

      // Emit domain event
      this.eventEmitter.emit('session.revoked', { sessionId, userId: sessionData.userId });
      // Observability layer
      this.logger.log({ event: 'session.revoked', sessionId, userId: sessionData.userId });

      return true;
    } catch (e) {
      this.logger.error(`Error invalidating session: ${e.message}`);
      return false;
    }
  }

  /**
   * Invalidate all sessions for a user (password reset, force-logout)
   */
  async invalidateUserSessions(userId: string): Promise<number> {
    try {
      const sessionIds = await redisConnection.smembers(`auth:user_sessions:${userId}`);
      
      if (sessionIds.length === 0) return 0;

      const pipeline = redisConnection.pipeline();
      sessionIds.forEach(id => pipeline.del(`auth:session:${id}`));
      pipeline.del(`auth:user_sessions:${userId}`);
      await pipeline.exec();

      sessionIds.forEach(id => {
        this.eventEmitter.emit('session.revoked', { sessionId: id, userId });
      });
      this.logger.log({ event: 'session.revoked.bulk', userId, count: sessionIds.length });

      return sessionIds.length;
    } catch (e) {
      this.logger.error(`Error invalidating user sessions: ${e.message}`);
      return 0;
    }
  }

  /**
   * Get all active (non-expired) sessions for a user
   */
  async getUserSessions(userId: string): Promise<SessionData[]> {
    try {
      const sessionIds = await redisConnection.smembers(`auth:user_sessions:${userId}`);
      if (sessionIds.length === 0) return [];

      const sessionStrings = await redisConnection.mget(sessionIds.map(id => `auth:session:${id}`));
      
      const sessions: SessionData[] = [];
      const expiredIds: string[] = [];

      sessionStrings.forEach((str, index) => {
        if (str) {
          sessions.push(JSON.parse(str));
        } else {
          // Track orphaned IDs in the user set to clean them up
          expiredIds.push(sessionIds[index]);
          this.eventEmitter.emit('session.expired', { sessionId: sessionIds[index], userId });
        }
      });

      if (expiredIds.length > 0) {
        await redisConnection.srem(`auth:user_sessions:${userId}`, ...expiredIds);
        this.logger.log({ event: 'session.expired.cleanup', userId, count: expiredIds.length });
      }

      return sessions.sort((a, b) => b.lastActivity - a.lastActivity);
    } catch (e) {
      this.logger.error(`Error getting user sessions: ${e.message}`);
      // Fail closed
      return [];
    }
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

    // Sessions from multiple geographic regions (basic IP check)
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

  // ─── Private helpers ───────────────────────────────────────

  private sanitizeUserAgent(userAgent: string): string {
    if (!userAgent) {
      return 'Unknown';
    }
    return userAgent.substring(0, 500).replace(/[<>]/g, '').trim();
  }

  private getIPRange(ip: string): string {
    if (!ip) return 'unknown';
    const parts = ip.split('.');
    if (parts.length >= 2) return `${parts[0]}.${parts[1]}`;
    const ipv6Parts = ip.split(':');
    if (ipv6Parts.length >= 1) return ipv6Parts[0];
    return 'unknown';
  }
}
