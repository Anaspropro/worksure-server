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
import { DeliverablesModule } from './modules/deliverables/deliverables.module';
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
import { VerificationModule } from './modules/verification/verification.module';
import { TaxonomyModule } from './modules/taxonomy/taxonomy.module';
import { AppConfigModule } from './config/app-config.module';
import { PrismaModule } from './database/prisma.module';
import { AuditModule } from './modules/audit/audit.module';
import { MonitoringModule } from './modules/monitoring/monitoring.module';
import { ReconciliationModule } from './modules/reconciliation/reconciliation.module';
import { LoggingMiddleware } from './common/middleware/logging.middleware';
import { MetricsGuardMiddleware } from './common/middleware/metrics-guard.middleware';
import { AuditContextMiddleware } from './common/middleware/audit-context.middleware';
import { RedisThrottlerStorage } from './common/throttler/redis-throttler-storage';
import { SanitizationService } from './common/services/sanitization.service';
import { ScheduleModule } from '@nestjs/schedule';
import { AppCacheModule } from './common/cache/cache.module';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { CacheModule } from '@nestjs/cache-manager';
import { EventsModule } from './modules/events/events.module';
import KeyvRedis from '@keyv/redis';
import { Keyv } from 'keyv';
import { redisConnection, getBullRedisOptions } from './queue/redis';
import { BullModule } from '@nestjs/bullmq';
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
      middleware: {
        mount: true,
        generateId: true,
        idGenerator: (req: any) => req.headers['x-request-id'] ?? uuidv4(),
      },
    }),
    LoggerModule.forRootAsync({
      inject: [ClsService],
      useFactory: (cls: ClsService) => {
        return {
          pinoHttp: {
            transport: (() => {
              if (process.env.NODE_ENV === 'production') return undefined;
              try {
                require.resolve('pino-pretty');
                return { target: 'pino-pretty', options: { singleLine: true } };
              } catch {
                return undefined;
              }
            })(),
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
    BullModule.forRootAsync({
      useFactory: () => ({
        connection: getBullRedisOptions(),
      }),
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
    CacheModule.registerAsync<any>({
      isGlobal: true,
      useFactory: () => {
        const isRedisReady =
          redisConnection &&
          (redisConnection.status === 'ready' ||
            redisConnection.status === undefined);
        if (isRedisReady) {
          try {
            return {
              stores: [new KeyvRedis(redisConnection as any)],
            };
          } catch {
            return {
              stores: [new Keyv()],
            };
          }
        }
        return {
          stores: [new Keyv()],
        };
      },
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
    DeliverablesModule,
    WalletModule,
    ChatModule,
    PaymentsModule,
    ReviewsModule,
    DisputesModule,
    NotificationsModule,
    VerificationModule,
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
    consumer.apply(AuditContextMiddleware).forRoutes('*');
    consumer.apply(LoggingMiddleware).forRoutes('*');
    consumer.apply(MetricsGuardMiddleware).forRoutes('metrics');
  }
}
