import { Module } from '@nestjs/common';
import { KycService } from './kyc.service';
import { KycController } from './kyc.controller';
import { PrismaModule } from '../../database/prisma.module';
import { PaymentsModule } from '../payments/payments.module';
import { AuthModule } from '../auth/auth.module';
import { PaystackClientService } from '../../common/services/paystack-client.service';

@Module({
  imports: [PrismaModule, PaymentsModule, AuthModule],
  controllers: [KycController],
  providers: [KycService, PaystackClientService],
  exports: [KycService],
})
export class KycModule {}
