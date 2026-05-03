import { Module, forwardRef } from '@nestjs/common';
import { PrismaModule } from '../../database/prisma.module';
import { PaymentsService } from './payments.service';
import { PaymentsController } from './payments.controller';
import { AuthModule } from '../auth/auth.module';
import { ContractsModule } from '../contracts/contracts.module';
import { WebhookSignatureService } from '../../common/services/webhook-signature.service';
import { NightlyReconciliationService } from './reconciliation.service';

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
  ],
  exports: [PaymentsService],
})
export class PaymentsModule {}
