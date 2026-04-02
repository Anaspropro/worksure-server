import { Module } from '@nestjs/common';
import { HealthController } from './health.controller';
import { PrismaModule } from '../../database/prisma.module';
import { AppConfigModule } from '../../config/app-config.module';

@Module({
  imports: [PrismaModule, AppConfigModule],
  controllers: [HealthController],
})
export class HealthModule {}
