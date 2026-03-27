import { Injectable } from '@nestjs/common';
import { ARCHITECTURE_SUMMARY } from './common/constants/architecture-summary';
import { AppConfigService } from './config/app-config.service';
import { PrismaService } from './database/prisma.service';

@Injectable()
export class AppService {
  constructor(
    private readonly appConfigService: AppConfigService,
    private readonly prismaService: PrismaService,
  ) {}

  getArchitectureSummary() {
    return {
      ...ARCHITECTURE_SUMMARY,
      runtime: {
        port: this.appConfigService.port,
        databaseUrlConfigured: this.appConfigService.isDatabaseConfigured,
        prismaStatus: this.prismaService.getStatus(),
      },
    };
  }
}
