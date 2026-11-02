import {
  Injectable,
  Inject,
  Optional,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ClsService } from 'nestjs-cls';
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

  constructor(
    @Inject(AppConfigService)
    private readonly appConfigService: AppConfigService,
    @Optional()
    @Inject(ClsService)
    private readonly cls?: ClsService,
  ) {
    const { adapter, pool } = createPrismaAdapter(
      appConfigService?.databaseUrl || process.env.DATABASE_URL,
    );

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

  /**
   * Executes database operations scoped strictly to a specific user under PostgreSQL Row-Level Security (RLS).
   */
  async withUser<T>(
    userId: string,
    role: string,
    operation: (tx: PrismaService) => Promise<T>,
  ): Promise<T> {
    const sanitizedId = userId.replace(/'/g, "''");
    const sanitizedRole = (role || 'CLIENT').replace(/'/g, "''");

    return this.$transaction(async (tx) => {
      await tx.$executeRawUnsafe(
        `SET LOCAL app.current_user_id = '${sanitizedId}'; SET LOCAL app.current_user_role = '${sanitizedRole}';`,
      );
      return operation(tx as unknown as PrismaService);
    });
  }

  /**
   * Executes database operations with explicit RLS bypass (for admin, migration, or internal worker operations).
   */
  async withBypassRls<T>(operation: (tx: PrismaService) => Promise<T>): Promise<T> {
    return this.$transaction(async (tx) => {
      await tx.$executeRawUnsafe(`SET LOCAL app.bypass_rls = 'on';`);
      return operation(tx as unknown as PrismaService);
    });
  }

  async runInTransaction<T>(operation: () => Promise<T>): Promise<T> {
    const userId = this.cls?.isActive() ? this.cls.get<string>('userId') : undefined;
    const userRole = this.cls?.isActive() ? this.cls.get<string>('userRole') : undefined;

    return this.$transaction(async (tx) => {
      if (userId) {
        const sanitizedId = userId.replace(/'/g, "''");
        const sanitizedRole = (userRole || 'CLIENT').replace(/'/g, "''");
        await tx.$executeRawUnsafe(
          `SET LOCAL app.current_user_id = '${sanitizedId}'; SET LOCAL app.current_user_role = '${sanitizedRole}';`,
        );
      }
      return operation();
    });
  }
}
