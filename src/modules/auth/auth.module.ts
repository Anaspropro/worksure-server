import { Module, forwardRef } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { UsersModule } from '../users/users.module';
import { AppConfigModule } from '../../config/app-config.module';
import { AppConfigService } from '../../config/app-config.service';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { AccountLockoutService } from '../../common/services/account-lockout.service';
import { SessionService } from '../../common/services/session.service';

@Module({
  imports: [
    forwardRef(() => UsersModule),
    AppConfigModule,
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
  providers: [AuthService, JwtAuthGuard, AccountLockoutService, SessionService],
  exports: [AuthService, JwtAuthGuard, SessionService],
})
export class AuthModule {}
