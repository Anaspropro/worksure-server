import { Injectable, NestMiddleware, Logger } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

export interface RequestWithLog extends Request {
  startTime: number;
  requestId: string;
  correlationId: string;
}



@Injectable()
export class LoggingMiddleware implements NestMiddleware {
  private readonly logger = new Logger('HTTP');

  use(req: RequestWithLog, res: Response, next: NextFunction) {
    const headerRequestId = req.get('x-request-id');
    const headerCorrelationId = req.get('x-correlation-id');
    const requestId = headerRequestId || this.generateRequestId();
    const correlationId = headerCorrelationId || this.generateRequestId();
    const startTime = Date.now();

    // Attach to request for later use
    req.requestId = requestId;
    req.correlationId = correlationId;
    req.startTime = startTime;

    // Propagate tracing identifiers to clients for correlation
    res.setHeader('X-Request-Id', requestId);
    res.setHeader('X-Correlation-Id', correlationId);

    // Log suspicious patterns
    this.detectSuspiciousPatterns(req, requestId);

    // Override res.end to log security events only (standard logging is done by pino-http)
    const originalEnd = res.end.bind(res) as (chunk?: any, encoding?: any, cb?: any) => Response;
    res.end = ((
      chunk?: any,
      encoding?: any,
      cb?: any,
    ) => {
      const duration = Date.now() - startTime;
      this.logSecurityEvents(req, res, requestId, correlationId, duration);
      return originalEnd(chunk, encoding, cb);
    }) as Response['end'];

    next();
  }



  private logSecurityEvents(
    req: RequestWithLog,
    res: Response,
    requestId: string,
    correlationId: string,
    duration: number,
  ) {
    const statusCode = res.statusCode;

    // Log authentication failures
    if (req.originalUrl.includes('/auth/') && statusCode >= 400) {
      this.logger.warn(
        `Authentication failure: ${req.method} ${req.originalUrl} - IP: ${req.ip} - ID: ${requestId}`,
        `Correlation: ${correlationId}`,
      );
    }

    // Log potential attacks
    if (statusCode === 429) {
      this.logger.warn(
        `Rate limit exceeded: ${req.method} ${req.originalUrl} - IP: ${req.ip} - ID: ${requestId}`,
        `Correlation: ${correlationId}`,
      );
    }

    // Log slow requests (potential DoS)
    if (duration > 5000) {
      this.logger.warn(
        `Slow request detected: ${req.method} ${req.originalUrl} - ${duration}ms - IP: ${req.ip} - ID: ${requestId}`,
        `Correlation: ${correlationId}`,
      );
    }

    // Log admin access
    if (req.originalUrl.includes('/admin/')) {
      this.logger.log(
        `Admin access: ${req.method} ${req.originalUrl} - IP: ${req.ip} - ID: ${requestId}`,
        `Correlation: ${correlationId}`,
      );
    }
  }

  private detectSuspiciousPatterns(req: RequestWithLog, requestId: string) {
    const userAgent = req.get('User-Agent') || '';
    const url = req.originalUrl.toLowerCase();

    // Detect common attack patterns
    const suspiciousPatterns = [
      /\.\./, // Path traversal
      /<script/i, // XSS
      /union.*select/i, // SQL injection
      /javascript:/i, // JavaScript protocol
      /data:/i, // Data protocol
    ];

    const hasSuspiciousPattern = suspiciousPatterns.some(
      (pattern) => pattern.test(url) || pattern.test(userAgent),
    );

    if (hasSuspiciousPattern) {
      this.logger.warn(
        `Suspicious request pattern detected: ${req.method} ${req.originalUrl} - IP: ${req.ip} - UA: ${userAgent} - ID: ${requestId}`,
      );
    }

    // Detect missing user agent (potential bot)
    if (!userAgent || userAgent.length < 10) {
      this.logger.warn(
        `Request with missing/short User-Agent: ${req.method} ${req.originalUrl} - IP: ${req.ip} - ID: ${requestId}`,
      );
    }
  }

  private generateRequestId(): string {
    return `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
  }

  private sanitizeLogData(data: string): string {
    // Remove potential log injection characters
    return data
      .replace(/[\r\n]/g, '')
      .replace(/[<>]/g, '')
      .substring(0, 200); // Limit length
  }
}
