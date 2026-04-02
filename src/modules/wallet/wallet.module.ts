import { Module, forwardRef } from '@nestjs/common';
import { WalletController } from './wallet.controller';
import { WalletService } from './wallet.service';
import { PrismaService } from '../../database/prisma.service';
import { PaymentsModule } from '../payments/payments.module';
import { DisputesModule } from '../disputes/disputes.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [
    forwardRef(() => PaymentsModule),
    forwardRef(() => DisputesModule),
    forwardRef(() => AuthModule),
  ],
  controllers: [WalletController],
  providers: [WalletService, PrismaService],
  exports: [WalletService],
})
export class WalletModule {}
