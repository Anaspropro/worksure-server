import { Module } from '@nestjs/common';
import { TerminusModule } from '@nestjs/terminus';
import { HealthController } from './health.controller';
import { PrismaModule } from '../../database/prisma.module';
import { AppConfigModule } from '../../config/app-config.module';
import { AppCacheModule } from '../../common/cache/cache.module';
import { MonitoringModule } from '../monitoring/monitoring.module';
import { BullMQHealthIndicator } from './bullmq-health.indicator';

@Module({
  imports: [TerminusModule, PrismaModule, AppConfigModule, AppCacheModule, MonitoringModule],
  controllers: [HealthController],
  providers: [BullMQHealthIndicator],
})
export class HealthModule {}
