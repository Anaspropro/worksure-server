import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { v7 as uuidv7 } from 'uuid';
import { PrismaService } from '../../database/prisma.service';
import { RedisCacheService } from '../../common/cache/redis-cache.service';
import {
  AuditEntityType,
  JobStatus,
  TransactionType,
  DisputeStatus,
  UserRole,
} from '../../generated/prisma';

export type ReportType =
  | 'jobs_per_month'
  | 'platform_earnings'
  | 'active_disputes'
  | 'top_artisans'
  | 'overview';

const REPORT_TYPES: ReportType[] = [
  'jobs_per_month',
  'platform_earnings',
  'active_disputes',
  'top_artisans',
  'overview',
];

@Injectable()
export class AnalyticsService {
  private readonly logger = new Logger(AnalyticsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly cacheService: RedisCacheService,
  ) {}

  async generateReports(reportType: ReportType = 'overview', month?: string, force = false) {
    if (!REPORT_TYPES.includes(reportType)) {
      throw new BadRequestException(`Unsupported report type: ${reportType}.`);
    }

    const cacheKey = `analytics:report:${reportType}:${month ?? 'all'}:v3`;
    
    if (!force) {
      const cached = await this.cacheService.get<any>(cacheKey);

      if (cached) {
        this.logger.debug(`Cache hit for ${cacheKey}`);
        return cached;
      }
    }

    this.logger.debug(`Cache miss/force for ${cacheKey}, executing heavy queries...`);
    let reportData: Record<string, unknown>;

    switch (reportType) {
      case 'jobs_per_month': {
        const jobStats = await this.prisma.job.groupBy({
          by: ['status'],
          _count: { id: true },
        });
        const statusMap = Object.fromEntries(
          jobStats.map((s) => [s.status, s._count.id]),
        );
        reportData = {
          reportType: 'jobs_per_month',
          filters: { month: month ?? '2026-03' },
          totals: {
            jobsCreated: Object.values(statusMap).reduce(
              (sum, c) => sum + (c as number),
              0,
            ),
            inProgress: statusMap[JobStatus.IN_PROGRESS] ?? 0,
            completed: statusMap[JobStatus.COMPLETED] ?? 0,
          },
        };
        break;
      }
      case 'platform_earnings': {
        const feeAgg = await this.prisma.transaction.aggregate({
          where: { type: TransactionType.PLATFORM_FEE },
          _sum: { amount: true },
        });
        reportData = {
          reportType: 'platform_earnings',
          totals: {
            grossFees: feeAgg._sum.amount ?? 0,
            generatedAt: new Date().toISOString(),
          },
        };
        break;
      }
      case 'active_disputes': {
        const [activeCount, resolvedCount] = await Promise.all([
          this.prisma.dispute.count({
            where: { status: DisputeStatus.OPEN },
          }),
          this.prisma.dispute.count({
            where: { status: DisputeStatus.RESOLVED },
          }),
        ]);
        reportData = {
          reportType: 'active_disputes',
          totals: {
            active: activeCount,
            resolved: resolvedCount,
          },
        };
        break;
      }
      case 'top_artisans': {
        const leaderboard = await this.prisma.job.groupBy({
          by: ['artisanId'],
          where: {
            status: JobStatus.COMPLETED,
            artisanId: { not: null },
          },
          _count: { id: true },
          _sum: { amount: true },
          orderBy: { _count: { id: 'desc' } },
          take: 20,
        });
        const artisanIds = leaderboard
          .map((entry) => entry.artisanId)
          .filter((id): id is string => id !== null);
        const artisanUsers =
          artisanIds.length > 0
            ? await this.prisma.user.findMany({
                where: { id: { in: artisanIds } },
                select: { id: true, name: true, artisanVerified: true },
              })
            : [];
        const artisanMap = new Map(
          artisanUsers.map((u) => [u.id, u]),
        );
        reportData = {
          reportType: 'top_artisans',
          data: leaderboard.map((entry) => {
            const user = artisanMap.get(entry.artisanId!);
            return {
              artisanId: entry.artisanId,
              name: user?.name ?? 'Unknown',
              verified: user?.artisanVerified ?? false,
              completedJobs: entry._count.id,
              earnings: entry._sum.amount ?? 0,
            };
          }),
        };
        break;
      }
      case 'overview':
      default: {
        const escrowStatuses = [
          'FUNDED',
          'ACTIVE',
          'IN_PROGRESS',
          'CLIENT_CONFIRMED',
          'READY_FOR_PAYOUT',
          'DISPUTED',
        ];

        const [
          userCount, 
          jobStatusGroups, 
          openDisputes, 
          feeTotal, 
          flaggedJobs, 
          pendingArtisansCount, 
          pendingPayoutsCount,
          walletAgg,
          escrowAgg
        ] = await Promise.all([
            this.prisma.user.count(),
            this.prisma.job.groupBy({
              by: ['status'],
              _count: { id: true },
            }),
            this.prisma.dispute.count({
              where: { status: DisputeStatus.OPEN },
            }),
            this.prisma.transaction.aggregate({
              where: { type: TransactionType.PLATFORM_FEE },
              _sum: { amount: true },
            }),
            this.prisma.job.count({ where: { flagged: true } }),
            this.prisma.user.count({ where: { role: UserRole.ARTISAN, artisanVerified: false } }),
            this.prisma.contract.count({ where: { status: 'READY_FOR_PAYOUT' } }),
            this.prisma.ledgerAccount.aggregate({
              where: { type: 'USER_WALLET' },
              _sum: { balance: true },
            }),
            this.prisma.contract.aggregate({
              where: { status: { in: escrowStatuses as any } },
              _sum: { amount: true },
            }),
          ]);
        const jobMap = Object.fromEntries(
          jobStatusGroups.map((s) => [s.status, s._count.id]),
        );
        // Wallet balance already includes frozen funds (escrow), so adding escrow amounts would double-count.
        const totalSystemValue = walletAgg._sum.balance ?? 0;
        
        reportData = {
          reportType: 'overview',
          totals: {
            users: userCount,
            activeJobs: jobMap[JobStatus.IN_PROGRESS] ?? 0,
            openDisputes,
            platformFees: feeTotal._sum.amount ?? 0,
            flaggedJobs,
            pendingArtisansCount,
            pendingPayoutsCount,
            totalSystemValue,
            lockedInEscrow: escrowAgg._sum.amount ?? 0,
          },
        };
        break;
      }
    }

    const result = {
      data: reportData,
      exportFormats: ['json', 'csv'],
    };

    // Cache the expensive report result for 15 minutes
    await this.cacheService.set(cacheKey, result, 15 * 60 * 1000);

    // Perform audit logging asynchronously to avoid blocking the response
    this.prisma.auditLog.create({
      data: {
        id: uuidv7(),
        action: 'REPORT_GENERATED',
        entityType: AuditEntityType.REPORT,
        entityId: reportType,
        performedBy: 'system',
        performedAt: new Date(),
        metadata: { reportType, month } as any,
      },
    }).catch(err => this.logger.error(`Failed to log audit action: ${err.message}`));

    return result;
  }

  async getContractStats() {
    const cacheKey = 'analytics:contract:stats';
    const cached = await this.cacheService.get<any>(cacheKey);

    if (cached) {
      this.logger.debug(`Cache hit for ${cacheKey}`);
      return cached;
    }

    this.logger.debug(`Cache miss for ${cacheKey}, executing heavy queries...`);

    const escrowStatuses = [
      'FUNDED',
      'ACTIVE',
      'IN_PROGRESS',
      'CLIENT_CONFIRMED',
      'READY_FOR_PAYOUT',
      'DISPUTED',
    ];

    const [
      statusGroups,
      totalAgg,
      escrowAgg,
      payoutAgg,
      refundAgg,
      totalCount,
    ] = await Promise.all([
      this.prisma.contract.groupBy({
        by: ['status'],
        _count: { id: true },
        _sum: { amount: true },
      }),
      this.prisma.contract.aggregate({ _sum: { amount: true } }),
      this.prisma.contract.aggregate({
        where: { status: { in: escrowStatuses as any } },
        _sum: { amount: true },
        _count: { id: true },
      }),
      this.prisma.contract.aggregate({
        where: { status: 'PAID_OUT' },
        _sum: { amount: true },
      }),
      this.prisma.contract.aggregate({
        where: { status: 'REFUNDED' },
        _sum: { amount: true },
      }),
      this.prisma.contract.count(),
    ]);

    const statusDistribution = Object.fromEntries(
      statusGroups.map((s) => [s.status, s._count.id]),
    );
    const totalVolume = totalAgg._sum.amount ?? 0;

    const result = {
      totalCount,
      statusDistribution,
      totalVolume,
      escrowVolume: escrowAgg._sum.amount ?? 0,
      payoutVolume: payoutAgg._sum.amount ?? 0,
      refundVolume: refundAgg._sum.amount ?? 0,
      averageValue: totalCount > 0 ? totalVolume / totalCount : 0,
      activeContractCount: escrowAgg._count.id,
    };

    await this.cacheService.set(cacheKey, result, 5 * 60 * 1000); // 5 mins
    return result;
  }
}
