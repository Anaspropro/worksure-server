import { Module, MiddlewareConsumer, NestModule } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AdminModule } from './modules/admin/admin.module';
import { ArtisanModule } from './modules/artisan/artisan.module';
import { AuthModule } from './modules/auth/auth.module';
import { ContractsModule } from './modules/contracts/contracts.module';
import { DisputesModule } from './modules/disputes/disputes.module';
import { HealthModule } from './modules/health/health.module';
import { JobsModule } from './modules/jobs/jobs.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { PaymentsModule } from './modules/payments/payments.module';
import { ProposalsModule } from './modules/proposals/proposals.module';
import { ReviewsModule } from './modules/reviews/reviews.module';
import { UsersModule } from './modules/users/users.module';
import { WalletModule } from './modules/wallet/wallet.module';
import { AppConfigModule } from './config/app-config.module';
import { PrismaModule } from './database/prisma.module';
import { RateLimitMiddleware } from './common/middleware/rate-limit.middleware';
import { LoggingMiddleware } from './common/middleware/logging.middleware';
import { SanitizationService } from './common/services/sanitization.service';

@Module({
  imports: [
    AppConfigModule,
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
    PaymentsModule,
    ReviewsModule,
    DisputesModule,
    NotificationsModule,
  ],
  controllers: [AppController],
  providers: [AppService, SanitizationService],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(LoggingMiddleware)
      .forRoutes('*')
      .apply(RateLimitMiddleware)
      .forRoutes(
        'auth/login',
        'auth/register',
        'auth/forgot-password',
        'auth/reset-password',
      );
  }
}
