import { Module, forwardRef } from '@nestjs/common';
import { ContractsController } from './contracts.controller';
import { ContractsService } from './contracts.service';
import { PaymentsModule } from '../payments/payments.module';
import { DisputesModule } from '../disputes/disputes.module';
import { AuthModule } from '../auth/auth.module';
import { IdempotencyService } from '../../common/services/idempotency.service';

@Module({
  imports: [
    forwardRef(() => PaymentsModule),
    forwardRef(() => DisputesModule),
    forwardRef(() => AuthModule),
  ],
  controllers: [ContractsController],
  providers: [ContractsService, IdempotencyService],
  exports: [ContractsService],
})
export class ContractsModule {}
