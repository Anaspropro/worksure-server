import { Injectable, NestMiddleware, Logger } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

export interface RequestWithLog extends Request {
  startTime: number;
  requestId: string;
}

type ResponseEnd = (
  chunk?: string | Uint8Array,
  encoding?: BufferEncoding,
  cb?: () => void,
) => Response;

@Injectable()
export class LoggingMiddleware implements NestMiddleware {
  private readonly logger = new Logger('HTTP');

  use(req: RequestWithLog, res: Response, next: NextFunction) {
    const requestId = this.generateRequestId();
    const startTime = Date.now();

    // Attach to request for later use
    req.requestId = requestId;
    req.startTime = startTime;

    // Log request
    this.logRequest(req, requestId);

    // Override res.end to log response
    const originalEnd = res.end.bind(res) as ResponseEnd;
    res.end = ((
      chunk?: string | Uint8Array,
      encoding?: BufferEncoding,
      cb?: () => void,
    ) => {
      const duration = Date.now() - startTime;

      // Log response
      this.logger.log(
        `${req.method} ${req.originalUrl} ${res.statusCode} - ${duration}ms - ${req.ip} - ${requestId}`,
      );

      // Log security events
      this.logSecurityEvents(req, res, requestId, duration);

      return originalEnd(chunk, encoding, cb);
    }) as Response['end'];

    next();
  }

  private logRequest(req: RequestWithLog, requestId: string) {
    const userAgent = req.get('User-Agent') || 'Unknown';
    const contentLength = req.get('Content-Length') || '0';

    // Sanitize URL to prevent log injection
    const sanitizedUrl = this.sanitizeLogData(req.originalUrl);

    this.logger.log(
      `Incoming Request: ${req.method} ${sanitizedUrl} - IP: ${req.ip} - UA: ${userAgent} - Content-Length: ${contentLength} - ID: ${requestId}`,
    );

    // Log suspicious patterns
    this.detectSuspiciousPatterns(req, requestId);
  }

  private logSecurityEvents(
    req: RequestWithLog,
    res: Response,
    requestId: string,
    duration: number,
  ) {
    const statusCode = res.statusCode;

    // Log authentication failures
    if (req.originalUrl.includes('/auth/') && statusCode >= 400) {
      this.logger.warn(
        `Authentication failure: ${req.method} ${req.originalUrl} - IP: ${req.ip} - ID: ${requestId}`,
      );
    }

    // Log potential attacks
    if (statusCode === 429) {
      this.logger.warn(
        `Rate limit exceeded: ${req.method} ${req.originalUrl} - IP: ${req.ip} - ID: ${requestId}`,
      );
    }

    // Log slow requests (potential DoS)
    if (duration > 5000) {
      this.logger.warn(
        `Slow request detected: ${req.method} ${req.originalUrl} - ${duration}ms - IP: ${req.ip} - ID: ${requestId}`,
      );
    }

    // Log admin access
    if (req.originalUrl.includes('/admin/')) {
      this.logger.log(
        `Admin access: ${req.method} ${req.originalUrl} - IP: ${req.ip} - ID: ${requestId}`,
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
