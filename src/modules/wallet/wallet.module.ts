import { Module } from '@nestjs/common';
import { WalletController } from './wallet.controller';
import { WalletService } from './wallet.service';
import { AuthModule } from '../auth/auth.module';
import { PaystackClientService } from '../../common/services/paystack-client.service';
import { VerificationModule } from '../verification/verification.module';

@Module({
  imports: [AuthModule, VerificationModule],
  controllers: [WalletController],
  providers: [WalletService, PaystackClientService],
  exports: [WalletService],
})
export class WalletModule {}
