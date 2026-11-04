import { Module } from '@nestjs/common';
import { ContractsController } from './contracts.controller';
import { ContractsService } from './contracts.service';
import { AuthModule } from '../auth/auth.module';
import { IdempotencyService } from '../../common/services/idempotency.service';

@Module({
  imports: [AuthModule],
  controllers: [ContractsController],
  providers: [ContractsService, IdempotencyService],
  exports: [ContractsService],
})
export class ContractsModule {}
