import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class DataPruningService {
  private readonly logger = new Logger(DataPruningService.name);

  constructor(private readonly prisma: PrismaService) {}

  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async pruneOldData() {
    this.logger.log('Starting nightly data pruning job...');

    try {
      const now = new Date();

      // 1. Prune SystemLogs older than 14 days
      const fourteenDaysAgo = new Date(
        now.getTime() - 14 * 24 * 60 * 60 * 1000,
      );
      const prunedSystemLogs = await this.prisma.systemLog.deleteMany({
        where: {
          createdAt: {
            lt: fourteenDaysAgo,
          },
        },
      });
      this.logger.log(
        `Pruned ${prunedSystemLogs.count} SystemLogs older than 14 days.`,
      );

      // 2. Prune routine Reconciliation AuditLogs older than 30 days
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      const prunedReconciliationLogs = await this.prisma.auditLog.deleteMany({
        where: {
          action: {
            in: [
              'RECONCILIATION_SUCCESS',
              'RECONCILIATION_DISCREPANCY',
              'NIGHTLY_RECONCILIATION_SUCCESS',
              'NIGHTLY_RECONCILIATION_DISCREPANCY',
            ],
          },
          performedAt: {
            lt: thirtyDaysAgo,
          },
        },
      });
      this.logger.log(
        `Pruned ${prunedReconciliationLogs.count} routine Reconciliation AuditLogs older than 30 days.`,
      );

      // 3. Prune all other AuditLogs older than 180 days (6 months)
      const oneEightyDaysAgo = new Date(
        now.getTime() - 180 * 24 * 60 * 60 * 1000,
      );
      const prunedAuditLogs = await this.prisma.auditLog.deleteMany({
        where: {
          performedAt: {
            lt: oneEightyDaysAgo,
          },
        },
      });
      this.logger.log(
        `Pruned ${prunedAuditLogs.count} general AuditLogs older than 180 days.`,
      );

      this.logger.log('Nightly data pruning job completed successfully.');
    } catch (error) {
      this.logger.error(
        'Failed to execute nightly data pruning job',
        error.stack,
      );
    }
  }
}
