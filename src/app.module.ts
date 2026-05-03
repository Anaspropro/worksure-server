import { Module, MiddlewareConsumer, NestModule } from '@nestjs/common';
import { ThrottlerModule } from '@nestjs/throttler';
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
import { ChatModule } from './modules/chat/chat.module';
import { KycModule } from './modules/kyc/kyc.module';
import { AppConfigModule } from './config/app-config.module';
import { PrismaModule } from './database/prisma.module';
import { LoggingMiddleware } from './common/middleware/logging.middleware';
import { SanitizationService } from './common/services/sanitization.service';
import { ScheduleModule } from '@nestjs/schedule';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    ThrottlerModule.forRoot([
      {
        name: 'default',
        ttl: 60000,
        limit: 10,
      },
    ]),
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
    ChatModule,
    PaymentsModule,
    ReviewsModule,
    DisputesModule,
    NotificationsModule,
    KycModule,
  ],
  controllers: [AppController],
  providers: [AppService, SanitizationService],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(LoggingMiddleware).forRoutes('*');
  }
}
