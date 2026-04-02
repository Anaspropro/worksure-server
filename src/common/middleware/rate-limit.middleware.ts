import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

interface RateLimitStore {
  [key: string]: {
    count: number;
    resetTime: number;
  };
}

@Injectable()
export class RateLimitMiddleware implements NestMiddleware {
  private store: RateLimitStore = {};
  private readonly windowMs = 15 * 60 * 1000; // 15 minutes
  private readonly maxRequests = 5; // 5 requests per window

  use(req: Request, res: Response, next: NextFunction) {
    const key = this.getKey(req);
    const now = Date.now();

    // Clean up expired entries
    this.cleanup(now);

    if (!this.store[key]) {
      this.store[key] = {
        count: 1,
        resetTime: now + this.windowMs,
      };
      return next();
    }

    const record = this.store[key];

    if (now > record.resetTime) {
      record.count = 1;
      record.resetTime = now + this.windowMs;
      return next();
    }

    if (record.count >= this.maxRequests) {
      const resetIn = Math.ceil((record.resetTime - now) / 1000);
      res.set('Retry-After', resetIn.toString());
      return res.status(429).json({
        message: 'Too many requests. Please try again later.',
        retryAfter: resetIn,
      });
    }

    record.count++;
    next();
  }

  private getKey(req: Request): string {
    // Use IP address for rate limiting
    return req.ip || req.connection.remoteAddress || 'unknown';
  }

  private cleanup(now: number) {
    Object.keys(this.store).forEach((key) => {
      if (now > this.store[key].resetTime) {
        delete this.store[key];
      }
    });
  }
}
