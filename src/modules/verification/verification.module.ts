import { Module } from '@nestjs/common';
import { MarketplaceVerificationService } from './marketplace.service';
import { FinancialVerificationService } from './financial.service';
import {
  VerificationController,
  VerificationWebhookController,
} from './verification.controller';
import { AdminVerificationController } from './admin-verification.controller';
import { PaystackVerificationProvider } from './providers/paystack.provider';
import { PrismaModule } from '../../database/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { PaystackClientService } from '../../common/services/paystack-client.service';
import { RolesGuard } from '../../common/guards/roles.guard';

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [
    VerificationController,
    VerificationWebhookController,
    AdminVerificationController,
  ],
  providers: [
    MarketplaceVerificationService,
    FinancialVerificationService,
    PaystackVerificationProvider,
    PaystackClientService,
    RolesGuard,
  ],
  exports: [MarketplaceVerificationService, FinancialVerificationService],
})
export class VerificationModule {}
