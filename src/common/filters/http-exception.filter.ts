import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Internal server error';
    let details: any = null;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const exceptionResponse = exception.getResponse();
      
      if (typeof exceptionResponse === 'string') {
        message = exceptionResponse;
      } else if (typeof exceptionResponse === 'object') {
        const responseObj = exceptionResponse as any;
        message = responseObj.message || responseObj.error || message;
        details = responseObj.details || null;
      }
    } else if (exception instanceof Error) {
      message = exception.message;
      this.logger.error(`Unexpected error: ${exception.message}`, exception.stack);
    } else {
      this.logger.error('Unknown exception type', exception);
    }

    const errorResponse = {
      statusCode: status,
      timestamp: new Date().toISOString(),
      path: request.url,
      method: request.method,
      message,
      ...(details && { details }),
      ...(status >= 500 && { 
        requestId: request.headers['x-request-id'] || 'unknown',
        correlationId: request.headers['x-correlation-id'] || 'unknown'
      }),
    };

    // Log errors for monitoring
    if (status >= 500) {
      this.logger.error(
        `${status} ${request.method} ${request.url}`,
        {
          error: exception,
          request: {
            headers: request.headers,
            body: request.body,
            query: request.query,
            params: request.params,
          },
        },
      );
    } else if (status >= 400) {
      this.logger.warn(
        `${status} ${request.method} ${request.url}: ${message}`,
        {
          request: {
            body: request.body,
            query: request.query,
            params: request.params,
          },
        },
      );
    }

    response.status(status).json(errorResponse);
  }
}
