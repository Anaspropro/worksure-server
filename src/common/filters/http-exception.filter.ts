import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { ErrorCode } from '../interfaces/error-code.enum';

type ExceptionResponseShape = {
  message?: string | string[];
  error?: string;
  code?: ErrorCode;
  details?: unknown;
};

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Internal server error';
    let code = ErrorCode.INTERNAL_ERROR;
    let details: any = null;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const exceptionResponse = exception.getResponse();

      if (typeof exceptionResponse === 'string') {
        message = exceptionResponse;
      } else if (typeof exceptionResponse === 'object') {
        const responseObj = exceptionResponse as ExceptionResponseShape;
        if (Array.isArray(responseObj.message)) {
          message = responseObj.message.join(', ');
        } else if (typeof responseObj.message === 'string') {
          message = responseObj.message;
        } else if (typeof responseObj.error === 'string') {
          message = responseObj.error;
        }

        if (responseObj.code) {
          code = responseObj.code;
        } else {
          // Default mapping based on status
          switch (status) {
            case HttpStatus.BAD_REQUEST:
              code = ErrorCode.VALIDATION_ERROR;
              break;
            case HttpStatus.UNAUTHORIZED:
              code = ErrorCode.UNAUTHORIZED;
              break;
            case HttpStatus.FORBIDDEN:
              code = ErrorCode.FORBIDDEN;
              break;
            case HttpStatus.NOT_FOUND:
              code = ErrorCode.NOT_FOUND;
              break;
            case HttpStatus.CONFLICT:
              code = ErrorCode.STATE_VIOLATION;
              break;
            case HttpStatus.PAYMENT_REQUIRED:
              code = ErrorCode.INSUFFICIENT_FUNDS;
              break;
            default:
              code =
                status >= 500
                  ? ErrorCode.INTERNAL_ERROR
                  : ErrorCode.VALIDATION_ERROR;
          }
        }

        details = responseObj.details ?? null;
      }
    } else if (exception instanceof Error) {
      message = exception.message;
      this.logger.error(
        `Unexpected error: ${exception.message}`,
        exception.stack,
      );
    } else {
      this.logger.error('Unknown exception type', exception);
    }

    const errorResponse = {
      statusCode: status,
      timestamp: new Date().toISOString(),
      path: request.url,
      method: request.method,
      message,
      code,
      ...(details && { details }),
      requestId:
        typeof (request as unknown as { requestId?: unknown }).requestId ===
        'string'
          ? (request as unknown as { requestId: string }).requestId
          : typeof request.headers['x-request-id'] === 'string'
            ? request.headers['x-request-id']
            : 'unknown',
      correlationId:
        typeof (request as unknown as { correlationId?: unknown })
          .correlationId === 'string'
          ? (request as unknown as { correlationId: string }).correlationId
          : typeof request.headers['x-correlation-id'] === 'string'
            ? request.headers['x-correlation-id']
            : 'unknown',
    };

    // Log errors for monitoring — redact sensitive data
    if (status >= 500) {
      this.logger.error(`${status} ${request.method} ${request.url}`, {
        error: exception instanceof Error ? exception.message : 'Unknown error',
        request: {
          method: request.method,
          path: request.url,
          requestId:
            typeof request.headers['x-request-id'] === 'string'
              ? request.headers['x-request-id']
              : 'unknown',
          correlationId:
            typeof request.headers['x-correlation-id'] === 'string'
              ? request.headers['x-correlation-id']
              : 'unknown',
        },
      });
    } else if (status >= 400) {
      this.logger.warn(
        `${status} ${request.method} ${request.url}: ${message}`,
      );
    }

    response.status(status).json(errorResponse);
  }
}
