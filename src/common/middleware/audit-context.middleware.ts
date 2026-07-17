import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { AsyncLocalStorage } from 'async_hooks';
import { randomUUID } from 'crypto';

export interface AuditContext {
  correlationId: string;
  ipAddress: string;
  userAgent: string;
  userId?: string; // Set later by auth guard
}

export const auditContextStorage = new AsyncLocalStorage<AuditContext>();

@Injectable()
export class AuditContextMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    const correlationId = (req.headers['x-correlation-id'] as string) || randomUUID();
    const ipAddress = req.ip || req.socket.remoteAddress || 'unknown';
    const userAgent = req.headers['user-agent'] || 'unknown';

    const context: AuditContext = {
      correlationId,
      ipAddress,
      userAgent,
    };

    auditContextStorage.run(context, () => {
      res.setHeader('x-correlation-id', correlationId);
      next();
    });
  }
}
