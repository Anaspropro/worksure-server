import { Injectable, NestMiddleware, Logger } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

type TraceableHeaders = Request['headers'] & {
  'x-request-id'?: string | string[];
  'x-correlation-id'?: string | string[];
};

@Injectable()
export class MonitoringMiddleware implements NestMiddleware {
  private readonly logger = new Logger(MonitoringMiddleware.name);

  use(req: Request, res: Response, next: NextFunction) {
    const startTime = Date.now();
    const headers = req.headers as TraceableHeaders;
    const requestIdHeader = headers['x-request-id'];
    const correlationIdHeader = headers['x-correlation-id'];
    const requestId =
      typeof requestIdHeader === 'string'
        ? requestIdHeader
        : this.generateRequestId();
    const correlationId =
      typeof correlationIdHeader === 'string'
        ? correlationIdHeader
        : this.generateRequestId();

    // Add request IDs to headers for tracing
    headers['x-request-id'] = requestId;
    headers['x-correlation-id'] = correlationId;
    res.setHeader('x-request-id', requestId);
    res.setHeader('x-correlation-id', correlationId);

    // Log incoming request
    this.logger.log(`${req.method} ${req.url} - Request started`, {
      requestId,
      correlationId,
      method: req.method,
      url: req.url,
      userAgent: req.headers['user-agent'],
      ip: req.ip || req.connection.remoteAddress,
      timestamp: new Date().toISOString(),
    });

    // Override res.end to log response
    const originalEnd = res.end.bind(res);
    res.end = ((
      chunk?: string | Uint8Array,
      encoding?: BufferEncoding,
      cb?: () => void,
    ) => {
      const duration = Date.now() - startTime;

      // Log response completion
      this.logger.log(
        `${req.method} ${req.url} - ${res.statusCode} - ${duration}ms`,
        {
          requestId,
          correlationId,
          statusCode: res.statusCode,
          duration,
          contentLength: res.get('content-length'),
          timestamp: new Date().toISOString(),
        },
      );

      // Call original end
      return originalEnd(chunk, encoding, cb);
    }) as Response['end'];

    next();
  }

  private generateRequestId(): string {
    return (
      Math.random().toString(36).substring(2, 15) +
      Math.random().toString(36).substring(2, 15)
    );
  }
}
