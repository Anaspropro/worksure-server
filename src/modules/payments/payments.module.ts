import { Module, forwardRef } from '@nestjs/common';
import { PrismaModule } from '../../database/prisma.module';
import { PaymentsService } from './payments.service';
import { PaymentsController } from './payments.controller';
import { AuthModule } from '../auth/auth.module';
import { ContractsModule } from '../contracts/contracts.module';
import { WalletModule } from '../wallet/wallet.module';
import { WebhookSignatureService } from '../../common/services/webhook-signature.service';
import { PaystackClientService } from '../../common/services/paystack-client.service';
import { IdempotencyService } from '../../common/services/idempotency.service';
import { StuckPayoutDetectorService } from './stuck-payout-detector.service';
import { PaystackWebhookService } from './paystack-webhook.service';
import { PaymentsListener } from './payments.listener';

@Module({
  imports: [
    PrismaModule,
    forwardRef(() => AuthModule),
    forwardRef(() => ContractsModule),
    forwardRef(() => WalletModule),
  ],
  controllers: [PaymentsController],
  providers: [
    PaymentsService,
    WebhookSignatureService,
    PaystackClientService,
    IdempotencyService,
    StuckPayoutDetectorService,
    PaystackWebhookService,
    PaymentsListener,
  ],
  exports: [PaymentsService],
})
export class PaymentsModule {}
