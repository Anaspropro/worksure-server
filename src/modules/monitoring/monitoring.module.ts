import { Module } from '@nestjs/common';
import { MonitoringService } from './monitoring.service';
import { MonitoringController } from './monitoring.controller';
import { PrismaModule } from '../../database/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { DataPruningService } from './data-pruning.service';

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [MonitoringController],
  providers: [MonitoringService, DataPruningService],
  exports: [MonitoringService],
})
export class MonitoringModule {}
