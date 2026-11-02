import {
  Injectable,
  NestMiddleware,
  UnauthorizedException,
} from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

@Injectable()
export class MetricsGuardMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    const metricsToken = process.env.METRICS_TOKEN;
    const authHeader = req.headers['authorization'];

    // 1. Check for valid bearer token if METRICS_TOKEN is configured
    if (metricsToken && authHeader === `Bearer ${metricsToken}`) {
      return next();
    }

    // 2. Allow local loopback addresses (127.0.0.1 or ::1 or ::ffff:127.0.0.1)
    const ip = req.ip || req.socket.remoteAddress || '';
    const isLocal =
      ip === '127.0.0.1' ||
      ip === '::1' ||
      ip === '::ffff:127.0.0.1' ||
      ip.includes('127.0.0.1');

    if (isLocal) {
      return next();
    }

    // 3. Fallback: deny access
    throw new UnauthorizedException(
      'Access to metrics endpoint is restricted.',
    );
  }
}
