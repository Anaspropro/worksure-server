import { Module } from '@nestjs/common';
import { MonitoringService } from './monitoring.service';
import { MonitoringController } from './monitoring.controller';
import { PrismaModule } from '../../database/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { DataPruningService } from './data-pruning.service';
import { AlertingService } from './alerting.service';
import { DiscordAlertProvider } from './providers/discord-alert.provider';
import { AppConfigModule } from '../../config/app-config.module';

@Module({
  imports: [PrismaModule, AuthModule, AppConfigModule],
  controllers: [MonitoringController],
  providers: [
    MonitoringService,
    DataPruningService,
    AlertingService,
    DiscordAlertProvider,
  ],
  exports: [MonitoringService, AlertingService],
})
export class MonitoringModule {}
