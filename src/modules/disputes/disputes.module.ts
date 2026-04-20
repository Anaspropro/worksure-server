import { Module, forwardRef } from '@nestjs/common';
import { PrismaModule } from '../../database/prisma.module';
import { DisputesService } from './disputes.service';
import { DisputesController } from './disputes.controller';
import { AuthModule } from '../auth/auth.module';
import { ContractsModule } from '../contracts/contracts.module';
import { PaymentsModule } from '../payments/payments.module';

@Module({
  imports: [
    PrismaModule,
    forwardRef(() => AuthModule),
    forwardRef(() => ContractsModule),
    forwardRef(() => PaymentsModule),
  ],
  controllers: [DisputesController],
  providers: [DisputesService],
  exports: [DisputesService],
})
export class DisputesModule {}
