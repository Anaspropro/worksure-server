import { Catch, ArgumentsHost, HttpException, HttpStatus } from '@nestjs/common';
import { BaseExceptionFilter } from '@nestjs/core';
import * as Sentry from '@sentry/nestjs';
import { AlertingService } from '../../modules/monitoring/alerting.service';

@Catch()
export class SentryFilter extends BaseExceptionFilter {
  constructor(
    applicationRef: any,
    private alertingService: AlertingService
  ) {
    super(applicationRef);
  }

  catch(exception: unknown, host: ArgumentsHost) {
    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    if (status >= 500) {
      Sentry.captureException(exception);
      const errorMsg = exception instanceof Error ? exception.message : 'Unknown exception';
      const stack = exception instanceof Error ? exception.stack : undefined;
      
      this.alertingService.sendFatalAlert(
        'unhandled_exception',
        'Unhandled Exception (500)',
        `An unhandled exception occurred: ${errorMsg}`,
        { stack, status }
      ).catch(() => {}); // Fire and forget
    }

    super.catch(exception, host);
  }
}
