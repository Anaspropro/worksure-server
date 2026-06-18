import { NestFactory } from '@nestjs/core';
import { Logger, LoggerErrorInterceptor } from 'nestjs-pino';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';
import { AppModule } from './app.module';
import { AppConfigService } from './config/app-config.service';
import { configureApp } from './app.setup';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    rawBody: true,
    bufferLogs: true,
  });
  app.useLogger(app.get(Logger));
  app.useGlobalInterceptors(
    new LoggerErrorInterceptor(),
    new LoggingInterceptor(),
  );

  const appConfigService = app.get(AppConfigService);

  configureApp(app);

  await app.listen(appConfigService.port);
}
void bootstrap();
