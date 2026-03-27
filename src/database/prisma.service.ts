import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { Pool } from 'pg';
import { PrismaClient } from '../generated/prisma';
import { AppConfigService } from '../config/app-config.service';
import { createPrismaAdapter } from './prisma-client-factory';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(PrismaService.name);
  private connected = false;
  private readonly pool?: Pool;

  constructor(private readonly appConfigService: AppConfigService) {
    const { adapter, pool } = createPrismaAdapter(appConfigService.databaseUrl);

    super({
      adapter,
    });

    this.pool = pool;
  }

  async onModuleInit() {
    if (!this.appConfigService.isDatabaseConfigured) {
      this.logger.warn(
        'DATABASE_URL is not configured yet. Prisma integration is scaffolded but not connected.',
      );
      return;
    }

    await this.$connect();
    this.connected = true;
    this.logger.log('Prisma client connected.');
  }

  async onModuleDestroy() {
    await this.$disconnect();
    await this.pool?.end();
    this.connected = false;
  }

  getStatus(): 'connected' | 'scaffolded' {
    return this.connected ? 'connected' : 'scaffolded';
  }

  async runInTransaction<T>(operation: () => Promise<T>): Promise<T> {
    return this.$transaction(async () => operation());
  }
}
