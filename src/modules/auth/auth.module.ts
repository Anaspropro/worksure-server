import { Module, forwardRef } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { UsersModule } from '../users/users.module';
import { AppConfigModule } from '../../config/app-config.module';
import { AppConfigService } from '../../config/app-config.service';
import { PrismaModule } from '../../database/prisma.module';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { AccountLockoutService } from '../../common/services/account-lockout.service';
import { SessionService } from '../../common/services/session.service';
import { EphemeralCleanupService } from '../../common/services/ephemeral-cleanup.service';
import { IdempotencyService } from '../../common/services/idempotency.service';
import { EmailService } from '../../common/services/email.service';

@Module({
  imports: [
    forwardRef(() => UsersModule),
    AppConfigModule,
    PrismaModule,
    JwtModule.registerAsync({
      imports: [AppConfigModule],
      inject: [AppConfigService],
      useFactory: (appConfigService: AppConfigService) => ({
        secret: appConfigService.jwtSecret,
        signOptions: {
          expiresIn: appConfigService.jwtExpiresIn,
        },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    JwtAuthGuard,
    AccountLockoutService,
    SessionService,
    EphemeralCleanupService,
    IdempotencyService,
    EmailService,
  ],
  exports: [AuthService, JwtAuthGuard, SessionService, JwtModule],
})
export class AuthModule {}
