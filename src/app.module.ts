import { Module, MiddlewareConsumer, NestModule } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { LoggerModule } from 'nestjs-pino';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { ClsModule, ClsService } from 'nestjs-cls';
import { v4 as uuidv4 } from 'uuid';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AdminModule } from './modules/admin/admin.module';
import { ArtisanModule } from './modules/artisan/artisan.module';
import { AuthModule } from './modules/auth/auth.module';
import { ContractsModule } from './modules/contracts/contracts.module';
import { DisputesModule } from './modules/disputes/disputes.module';
import { HealthModule } from './modules/health/health.module';
import { AnalyticsModule } from './modules/analytics/analytics.module';
import { QueueModule } from './modules/queue/queue.module';
import { JobsModule } from './modules/jobs/jobs.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { PaymentsModule } from './modules/payments/payments.module';
import { ProposalsModule } from './modules/proposals/proposals.module';
import { ReviewsModule } from './modules/reviews/reviews.module';
import { UsersModule } from './modules/users/users.module';
import { WalletModule } from './modules/wallet/wallet.module';
import { ChatModule } from './modules/chat/chat.module';
import { KycModule } from './modules/kyc/kyc.module';
import { TaxonomyModule } from './modules/taxonomy/taxonomy.module';
import { AppConfigModule } from './config/app-config.module';
import { PrismaModule } from './database/prisma.module';
import { AuditModule } from './modules/audit/audit.module';
import { MonitoringModule } from './modules/monitoring/monitoring.module';
import { ReconciliationModule } from './modules/reconciliation/reconciliation.module';
import { LoggingMiddleware } from './common/middleware/logging.middleware';
import { MetricsGuardMiddleware } from './common/middleware/metrics-guard.middleware';
import { RedisThrottlerStorage } from './common/throttler/redis-throttler-storage';
import { SanitizationService } from './common/services/sanitization.service';
import { ScheduleModule } from '@nestjs/schedule';
import { AppCacheModule } from './common/cache/cache.module';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { CacheModule } from '@nestjs/cache-manager';
import { EventsModule } from './modules/events/events.module';
import KeyvRedis from '@keyv/redis';
import { redisConnection } from './queue/redis';
import { PrometheusModule } from '@willsoto/nestjs-prometheus';

@Module({
  imports: [
    PrometheusModule.register({
      path: '/metrics',
      defaultMetrics: {
        enabled: true,
      },
    }),
    ClsModule.forRoot({
      global: true,
      middleware: { mount: true, generateId: true, idGenerator: (req: any) => req.headers['x-request-id'] ?? uuidv4() },
    }),
    LoggerModule.forRootAsync({
      inject: [ClsService],
      useFactory: (cls: ClsService) => {
        return {
          pinoHttp: {
            transport: process.env.NODE_ENV !== 'production'
              ? {
                  target: 'pino-pretty',
                  options: {
                    singleLine: true,
                  },
                }
              : undefined,
            autoLogging: false,
            customProps: () => ({
              userId: cls.get('userId'),
              traceId: cls.get('traceId'),
              contractId: cls.get('contractId'),
              transactionId: cls.get('transactionId'),
              paymentReference: cls.get('paymentReference'),
              walletId: cls.get('walletId'),
            }),
            serializers: {
              req: (req) => ({
                id: req.id,
                method: req.method,
                url: req.url,
              }),
            },
          },
        };
      },
    }),
    EventEmitterModule.forRoot({
      wildcard: true,
      delimiter: '.',
    }),
    ScheduleModule.forRoot(),
    ThrottlerModule.forRoot({
      throttlers: [
        {
          name: 'default',
          ttl: 60000,
          limit: 300,
        },
      ],
      storage: new RedisThrottlerStorage(),
    }),
    CacheModule.registerAsync({
      isGlobal: true,
      useFactory: () => ({
        stores: [new KeyvRedis(redisConnection as any)],
      }),
    }),
    AppConfigModule,
    AppCacheModule,
    EventsModule,
    PrismaModule,
    HealthModule,
    AdminModule,
    AuthModule,
    UsersModule,
    ArtisanModule,
    JobsModule,
    ProposalsModule,
    ContractsModule,
    WalletModule,
    ChatModule,
    PaymentsModule,
    ReviewsModule,
    DisputesModule,
    NotificationsModule,
    KycModule,
    AuditModule,
    MonitoringModule,
    ReconciliationModule,
    AnalyticsModule,
    QueueModule,
    TaxonomyModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    SanitizationService,
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(LoggingMiddleware).forRoutes('*');
    consumer.apply(MetricsGuardMiddleware).forRoutes('metrics');
  }
}
