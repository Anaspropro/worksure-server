import './tracing';
import { NestFactory, HttpAdapterHost } from '@nestjs/core';
import * as Sentry from '@sentry/nestjs';
import { nodeProfilingIntegration } from '@sentry/profiling-node';
import { Logger, LoggerErrorInterceptor } from 'nestjs-pino';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';
import { AppModule } from './app.module';
import { AppConfigService } from './config/app-config.service';
import { configureApp } from './app.setup';
import { SentryFilter } from './common/filters/sentry.filter';
import { AlertingService } from './modules/monitoring/alerting.service';
import { RedisIoAdapter } from './common/adapters/redis-io.adapter';

async function bootstrap() {
  Sentry.init({
    dsn: process.env.SENTRY_DSN || '',
    integrations: [nodeProfilingIntegration()],
    tracesSampleRate: 1.0,
    profilesSampleRate: 1.0,
  });

  const app = await NestFactory.create(AppModule, {
    rawBody: true,
    bufferLogs: true,
  });
  app.enableShutdownHooks();
  app.useLogger(app.get(Logger));
  app.useGlobalInterceptors(
    new LoggerErrorInterceptor(),
    new LoggingInterceptor(),
  );

  const { httpAdapter } = app.get(HttpAdapterHost);
  const alertingService = app.get(AlertingService);
  app.useGlobalFilters(new SentryFilter(httpAdapter, alertingService));

  const appConfigService = app.get(AppConfigService);

  configureApp(app);

  const redisIoAdapter = new RedisIoAdapter(app);
  await redisIoAdapter.connectToRedis();
  app.useWebSocketAdapter(redisIoAdapter);

  await app.listen(appConfigService.port);
}
void bootstrap();
