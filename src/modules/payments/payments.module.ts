import { Module, forwardRef } from '@nestjs/common';
import { PrismaModule } from '../../database/prisma.module';
import { PaymentsService } from './payments.service';
import { PaymentsController } from './payments.controller';
import { AuthModule } from '../auth/auth.module';
import { ContractsModule } from '../contracts/contracts.module';
import { WebhookSignatureService } from '../../common/services/webhook-signature.service';
import { NightlyReconciliationService } from './reconciliation.service';
import { PaystackClientService } from '../../common/services/paystack-client.service';
import { IdempotencyService } from '../../common/services/idempotency.service';
import { StuckPayoutDetectorService } from './stuck-payout-detector.service';

@Module({
  imports: [
    PrismaModule,
    forwardRef(() => AuthModule),
    forwardRef(() => ContractsModule),
  ],
  controllers: [PaymentsController],
  providers: [
    PaymentsService,
    WebhookSignatureService,
    NightlyReconciliationService,
    PaystackClientService,
    IdempotencyService,
    StuckPayoutDetectorService,
  ],
  exports: [PaymentsService],
})
export class PaymentsModule {}
