import { Module } from '@nestjs/common';
import { ReconciliationService } from './reconciliation.service';
import { ReconciliationController } from './reconciliation.controller';
import { PrismaModule } from '../../database/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { AppConfigModule } from '../../config/app-config.module';
import { PaystackClientService } from '../../common/services/paystack-client.service';

@Module({
  imports: [PrismaModule, AuthModule, AppConfigModule],
  controllers: [ReconciliationController],
  providers: [ReconciliationService, PaystackClientService],
  exports: [ReconciliationService],
})
export class ReconciliationModule {}
