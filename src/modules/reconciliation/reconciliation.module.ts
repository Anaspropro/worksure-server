import { Module } from '@nestjs/common';
import { ReconciliationService } from './reconciliation.service';
import { ReconciliationController } from './reconciliation.controller';
import { PrismaModule } from '../../database/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { AppConfigModule } from '../../config/app-config.module';
import { PaystackClientService } from '../../common/services/paystack-client.service';
import { MonitoringModule } from '../monitoring/monitoring.module';

@Module({
  imports: [PrismaModule, AuthModule, AppConfigModule, MonitoringModule],
  controllers: [ReconciliationController],
  providers: [ReconciliationService, PaystackClientService],
  exports: [ReconciliationService],
})
export class ReconciliationModule {}
