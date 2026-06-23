import { Module } from '@nestjs/common';
import { AnalyticsService } from './analytics.service';
import { PrismaModule } from '../../database/prisma.module';
import { AppCacheModule } from '../../common/cache/cache.module';

@Module({
  imports: [PrismaModule, AppCacheModule],
  providers: [AnalyticsService],
  exports: [AnalyticsService],
})
export class AnalyticsModule {}
