import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { v7 as uuidv7 } from 'uuid';
import { AuthService } from '../auth/auth.service';
import { PaymentsService } from '../payments/payments.service';
import { NotificationsService } from '../notifications/notifications.service';
import {
  AuditEntityType,
  ContractStatus,
  DisputeDecision,
  DisputeStatus,
  JobStatus,
  Prisma,
  TransactionStatus,
  TransactionType,
  UserRole,
  UserStatus,
} from '../../generated/prisma';
import { PrismaService } from '../../database/prisma.service';

type AdminActor = {
  id: string;
  role: string;
};

export type ResolveDisputeDecision = keyof typeof DisputeDecision;
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

const JOB_STATUSES = Object.values(JobStatus);
const TRANSACTION_TYPES = Object.values(TransactionType);
const DISPUTE_DECISIONS = Object.values(DisputeDecision);

type AdminUserRecord = Prisma.UserGetPayload<Record<string, never>>;
type AdminDisputeRecord = Prisma.DisputeGetPayload<{
  include: { history: { orderBy: { at: 'asc' } } };
}>;
type AdminJobRecord = Prisma.JobGetPayload<Record<string, never>>;
type AdminTransactionRecord = Prisma.TransactionGetPayload<
  Record<string, never>
>;
type AdminAuditLogRecord = Prisma.AuditLogGetPayload<Record<string, never>>;

@Injectable()
export class AdminService {
  private readonly logger = new Logger(AdminService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly authService: AuthService,
    private readonly paymentsService: PaymentsService,
    private readonly notificationsService: NotificationsService,
  ) {}

  async getAllUsers(search?: string, page = 1, limit = 50) {
    const take = Math.min(limit, 100);
    const skip = (page - 1) * take;

    const where: Prisma.UserWhereInput = search
      ? {
          OR: [
            { name: { contains: search, mode: 'insensitive' } },
            { email: { contains: search, mode: 'insensitive' } },
          ],
        }
      : {};

    const [data, statusGroups] = await Promise.all([
      this.prisma.user.findMany({
        where,
        orderBy: { createdAt: 'asc' },
        take,
        skip,
      }),
      this.prisma.user.groupBy({
        by: ['status'],
        where,
        _count: { id: true },
      }),
    ]);

    const statusMap = Object.fromEntries(
      statusGroups.map((g) => [g.status, g._count.id]),
    );
    const total = statusGroups.reduce((s, g) => s + g._count.id, 0);

    return {
      data: data.map((user) => this.mapUser(user)),
      meta: {
        total,
        page,
        limit: take,
        totalPages: Math.ceil(total / take),
        active: statusMap['ACTIVE'] ?? 0,
        banned: statusMap['BANNED'] ?? 0,
      },
    };
  }

  async getUserDetail(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        artisanProfile: true,
        wallet: true,
        transactions: {
          orderBy: { createdAt: 'desc' },
          take: 10,
        },
        notifications: {
          orderBy: { createdAt: 'desc' },
          take: 5,
        },
        clientJobs: {
          orderBy: { createdAt: 'desc' },
          take: 5,
        },
        artisanJobs: {
          orderBy: { createdAt: 'desc' },
          take: 5,
        },
        clientContracts: {
          orderBy: { createdAt: 'desc' },
          take: 5,
        },
        artisanContracts: {
          orderBy: { createdAt: 'desc' },
          take: 5,
        },
        sentReviews: {
          orderBy: { createdAt: 'desc' },
          take: 5,
        },
        receivedReviews: {
          orderBy: { createdAt: 'desc' },
          take: 5,
        },
      },
    });

    if (!user) {
      throw new NotFoundException(`User ${userId} not found.`);
    }

    return {
      data: {
        ...this.mapUser(user),
        lastLoginAt: user.lastLoginAt?.toISOString() ?? null,
        updatedAt: user.updatedAt.toISOString(),
        wallet: user.wallet
          ? {
              balance: user.wallet.balance,
              frozen: user.wallet.frozen,
              available: user.wallet.balance - user.wallet.frozen,
              updatedAt: user.wallet.updatedAt.toISOString(),
            }
          : null,
        artisanProfile: user.artisanProfile
          ? {
              bio: user.artisanProfile.bio ?? '',
              skills: this.jsonStringArray(user.artisanProfile.skills),
              experience: user.artisanProfile.experience ?? '',
              portfolio: this.jsonStringArray(user.artisanProfile.portfolio),
              verified: user.artisanProfile.verified,
              rating: user.artisanProfile.rating ?? 0,
              reviewCount: user.artisanProfile.reviewCount,
              updatedAt: user.artisanProfile.updatedAt.toISOString(),
            }
          : null,
        transactions: user.transactions.map((transaction) =>
          this.mapTransaction(transaction),
        ),
        notifications: user.notifications.map((notification) => ({
          id: notification.id,
          title: notification.title,
          message: notification.message,
          createdAt: notification.createdAt.toISOString(),
        })),
        activity: {
          clientJobs: user.clientJobs.map((job) => this.mapJob(job)),
          artisanJobs: user.artisanJobs.map((job) => this.mapJob(job)),
          clientContracts: user.clientContracts.map((contract) => ({
            id: contract.id,
            amount: contract.amount,
            status: contract.status,
            createdAt: contract.createdAt.toISOString(),
          })),
          artisanContracts: user.artisanContracts.map((contract) => ({
            id: contract.id,
            amount: contract.amount,
            status: contract.status,
            createdAt: contract.createdAt.toISOString(),
          })),
          sentReviews: user.sentReviews.map((review) => ({
            id: review.id,
            rating: review.rating,
            comment: review.comment,
            createdAt: review.createdAt.toISOString(),
          })),
          receivedReviews: user.receivedReviews.map((review) => ({
            id: review.id,
            rating: review.rating,
            comment: review.comment,
            createdAt: review.createdAt.toISOString(),
          })),
        },
      },
    };
  }

  async banUser(userId: string, actor: AdminActor) {
    const user = await this.findUser(userId);
    this.ensureAdminIsProtected(user, actor, 'ban');

    if (user.status === UserStatus.BANNED) {
      throw new ConflictException(`User ${user.id} is already banned.`);
    }

    const updatedUser = await this.prisma.user.update({
      where: { id: user.id },
      data: { status: UserStatus.BANNED },
    });

    await this.logAction('USER_BANNED', AuditEntityType.USER, user.id, actor, {
      userStatus: updatedUser.status,
    });

    return {
      message: `User ${updatedUser.id} has been banned.`,
      data: this.mapUser(updatedUser),
    };
  }

  async unbanUser(userId: string, actor: AdminActor) {
    const user = await this.findUser(userId);

    if (user.status === UserStatus.ACTIVE) {
      throw new ConflictException(`User ${user.id} is already active.`);
    }

    const updatedUser = await this.prisma.user.update({
      where: { id: user.id },
      data: { status: UserStatus.ACTIVE },
    });

    await this.logAction(
      'USER_UNBANNED',
      AuditEntityType.USER,
      user.id,
      actor,
      {
        userStatus: updatedUser.status,
      },
    );

    return {
      message: `User ${updatedUser.id} has been restored.`,
      data: this.mapUser(updatedUser),
    };
  }

  async verifyArtisan(userId: string, actor: AdminActor) {
    const user = await this.findUser(userId);

    if (user.role !== UserRole.ARTISAN) {
      throw new BadRequestException('Only artisan accounts can be verified.');
    }

    if (user.artisanVerified) {
      throw new ConflictException(`Artisan ${user.id} is already verified.`);
    }

    const updatedUser = await this.prisma.user.update({
      where: { id: user.id },
      data: { artisanVerified: true },
    });

    await this.logAction(
      'ARTISAN_VERIFIED',
      AuditEntityType.USER,
      user.id,
      actor,
      {
        artisanVerified: updatedUser.artisanVerified,
      },
    );

    return {
      message: `Artisan ${updatedUser.id} verified successfully.`,
      data: this.mapUser(updatedUser),
    };
  }

  async rejectArtisanVerification(userId: string, actor: AdminActor) {
    const user = await this.findUser(userId);

    if (user.role !== UserRole.ARTISAN) {
      throw new BadRequestException('Only artisan accounts can be rejected.');
    }

    if (user.artisanVerified) {
      throw new ConflictException(`Artisan ${user.id} is already verified.`);
    }

    const updatedUser = await this.prisma.user.update({
      where: { id: user.id },
      data: { artisanVerified: false }, // Maintain false state
    });

    await this.prisma.notification.create({
      data: {
        id: this.nextIdentifier(),
        userId: user.id,
        title: 'Verification Rejected',
        message: 'Your artisan verification request has been rejected. Please ensure your provided details are accurate and resubmit if necessary.',
        createdAt: new Date(),
      },
    });

    await this.logAction(
      'ARTISAN_VERIFICATION_REJECTED',
      AuditEntityType.USER,
      user.id,
      actor,
      {
        artisanVerified: false,
      },
    );

    return {
      message: `Artisan ${updatedUser.id} verification rejected.`,
      data: this.mapUser(updatedUser),
    };
  }

  async resetUserPassword(
    userId: string,
    actor: AdminActor,
    expiresInMinutes?: number,
  ) {
    const user = await this.findUser(userId);
    const requestedMinutes =
      typeof expiresInMinutes === 'number' ? expiresInMinutes : 30;

    if (requestedMinutes < 5 || requestedMinutes > 120) {
      throw new BadRequestException(
        'Password reset tokens must expire between 5 and 120 minutes.',
      );
    }

    const issuedReset = await this.authService.issueUserPasswordReset(
      user.id,
      requestedMinutes,
    );

    await this.logAction(
      'USER_PASSWORD_RESET',
      AuditEntityType.USER,
      user.id,
      actor,
      {
        resetWindowMinutes: requestedMinutes,
      },
    );

    return {
      message: `Password reset token issued for user ${user.id}.`,
      data: {
        userId: user.id,
        resetToken: issuedReset.resetToken,
        expiresAt: issuedReset.expiresAt.toISOString(),
      },
    };
  }

  async getAllDisputes(page = 1, limit = 50) {
    const take = Math.min(limit, 100);
    const skip = (page - 1) * take;
    const [disputes, total, active, resolved] = await Promise.all([
      this.prisma.dispute.findMany({
        include: {
          client: { select: { name: true } },
          artisan: { select: { name: true } },
          contract: { include: { job: { select: { title: true } } } },
          history: {
            orderBy: { at: 'asc' },
          },
        },
        orderBy: { createdAt: 'desc' },
        take,
        skip,
      }),
      this.prisma.dispute.count(),
      this.prisma.dispute.count({ where: { status: DisputeStatus.OPEN } }),
      this.prisma.dispute.count({ where: { status: DisputeStatus.RESOLVED } }),
    ]);

    return {
      data: disputes.map((dispute: any) => ({
        ...this.mapDispute(dispute),
        clientName: dispute.client.name,
        artisanName: dispute.artisan.name,
        contractTitle: dispute.contract?.job.title ?? 'Untitled Contract',
      })),
      meta: {
        total,
        page,
        limit: take,
        totalPages: Math.ceil(total / take),
        active,
        resolved,
      },
    };
  }

  async resolveDispute(
    disputeId: string,
    decision: ResolveDisputeDecision,
    actor: AdminActor,
    notes?: string,
  ) {
    const parsedDecision = this.ensureSupportedDecision(decision);
    const dispute = await this.findDispute(disputeId);

    if (dispute.status === DisputeStatus.RESOLVED) {
      throw new ConflictException(
        `Dispute ${dispute.id} has already been resolved.`,
      );
    }

    const resolvedAt = new Date();
    const notificationMessage =
      parsedDecision === DisputeDecision.REFUND_CLIENT
        ? `A refund of NGN ${dispute.amount} has been approved for dispute ${dispute.id}.`
        : `A payout of NGN ${dispute.amount} has been approved for dispute ${dispute.id}.`;

    // Step 1: Update dispute status + job flag atomically
    const updatedDispute = await this.prisma.$transaction(async (tx) => {
      await tx.dispute.update({
        where: { id: dispute.id },
        data: {
          status: DisputeStatus.RESOLVED,
          resolutionDecision: parsedDecision,
          resolvedAt,
          resolvedBy: actor.id,
          resolutionNotes: notes,
        },
      });

      await tx.disputeHistory.create({
        data: {
          id: this.nextIdentifier(),
          disputeId: dispute.id,
          action: 'DISPUTE_RESOLVED',
          at: resolvedAt,
          by: actor.id,
          notes,
        },
      });

      if (parsedDecision === DisputeDecision.REFUND_CLIENT && dispute.jobId) {
        await tx.job.update({
          where: { id: dispute.jobId },
          data: {
            status: JobStatus.FORCE_CLOSED,
            flagged: true,
            forceClosedAt: resolvedAt,
            forceCloseReason: `Dispute ${dispute.id} resolved with refund approval.`,
          },
        });
      }

      await tx.auditLog.create({
        data: {
          id: this.nextIdentifier(),
          action: 'DISPUTE_RESOLVED',
          entityType: AuditEntityType.DISPUTE,
          entityId: dispute.id,
          performedBy: actor.id,
          performedAt: resolvedAt,
          metadata: {
            decision: parsedDecision,
            amount: dispute.amount,
          },
        },
      });

      return tx.dispute.findUniqueOrThrow({
        where: { id: dispute.id },
        include: { history: { orderBy: { at: 'asc' } } },
      });
    });

    // Step 2: Route fund movement through the real payment service
    // This ensures actual escrow/refund logic runs (Paystack, ledger, wallet).
    let fundMovementSucceeded = false;
    try {
      if (!dispute.contractId) {
        throw new BadRequestException('Dispute is not associated with a contract');
      }

      if (parsedDecision === DisputeDecision.REFUND_CLIENT) {
        await this.paymentsService.refundContract(
          dispute.contractId,
          actor.id,
          true,  // isAdmin = true
          notes || `Dispute ${dispute.id} resolved: refund to client`,
        );
      } else {
        await this.paymentsService.releaseEscrowByAdmin(
          dispute.contractId,
          notes || `Dispute ${dispute.id} resolved: payout to artisan`,
        );
      }
      fundMovementSucceeded = true;
    } catch (err) {
      this.logger.error(
        `Dispute ${dispute.id} resolved but fund movement failed: ${
          err instanceof Error ? err.message : String(err)
        }`,
        err instanceof Error ? err.stack : undefined,
        'AdminService',
      );
      // Do not re-throw — the dispute record is already resolved.
      // An admin can manually trigger the payout/refund from the payments panel.
    }

    // Step 3: Send real-time notifications via NotificationsService
    await Promise.allSettled([
      this.notificationsService.createNotification({
        userId: dispute.clientId,
        type: 'system_alert' as any,
        title: 'Dispute Update',
        message: notificationMessage,
        entityId: dispute.id,
        entityType: 'dispute',
        priority: 'high' as any,
      }),
      this.notificationsService.createNotification({
        userId: dispute.artisanId,
        type: 'system_alert' as any,
        title: 'Dispute Update',
        message: notificationMessage,
        entityId: dispute.id,
        entityType: 'dispute',
        priority: 'high' as any,
      }),
    ]);

    return {
      message: `Dispute ${updatedDispute.id} resolved with decision ${parsedDecision}.`,
      data: this.mapDispute(updatedDispute),
      sideEffects: {
        fundMovementTriggered: fundMovementSucceeded,
        notificationsSent: 2,
        jobForceClosed: parsedDecision === DisputeDecision.REFUND_CLIENT,
      },
    };
  }

  async getAllJobs(search?: string, status?: string, page = 1, limit = 50) {
    const normalizedStatus = status?.toUpperCase();
    if (
      normalizedStatus &&
      !JOB_STATUSES.includes(normalizedStatus as JobStatus)
    ) {
      throw new BadRequestException(
        `Unsupported job status filter: ${status}.`,
      );
    }

    const take = Math.min(limit, 100);
    const skip = (page - 1) * take;

    const baseWhere: Prisma.JobWhereInput = normalizedStatus
      ? { status: normalizedStatus as JobStatus }
      : {};

    const where: Prisma.JobWhereInput = search
      ? {
          ...baseWhere,
          OR: [
            { title: { contains: search, mode: 'insensitive' } },
            { description: { contains: search, mode: 'insensitive' } },
          ],
        }
      : baseWhere;

    const [data, total, flagged] = await Promise.all([
      this.prisma.job.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take,
        skip,
      }),
      this.prisma.job.count({ where }),
      this.prisma.job.count({
        where: {
          ...where,
          flagged: true,
        },
      }),
    ]);

    return {
      data: data.map((job) => this.mapJob(job)),
      meta: {
        total,
        page,
        limit: take,
        totalPages: Math.ceil(total / take),
        flagged,
      },
    };
  }

  async forceCloseJob(jobId: string, actor: AdminActor, reason?: string) {
    const job = await this.findJob(jobId);
    if (job.status === JobStatus.FORCE_CLOSED) {
      throw new ConflictException(
        `Job ${job.id} has already been force-closed.`,
      );
    }

    if (job.status === JobStatus.COMPLETED) {
      throw new BadRequestException(
        `Job ${job.id} is already completed and cannot be force-closed.`,
      );
    }

    const resolvedReason =
      reason?.trim() || 'Suspicious activity detected by admin review.';
    const updatedJob = await this.prisma.job.update({
      where: { id: job.id },
      data: {
        status: JobStatus.FORCE_CLOSED,
        flagged: true,
        forceClosedAt: new Date(),
        forceCloseReason: resolvedReason,
      },
    });

    await this.logAction(
      'JOB_FORCE_CLOSED',
      AuditEntityType.JOB,
      job.id,
      actor,
      {
        reason: resolvedReason,
      },
    );

    return {
      message: `Job ${updatedJob.id} has been force-closed.`,
      data: this.mapJob(updatedJob),
    };
  }

  async getAllTransactions(type?: string, page = 1, limit = 50) {
    const normalizedType = type?.toUpperCase();
    if (
      normalizedType &&
      !TRANSACTION_TYPES.includes(normalizedType as TransactionType)
    ) {
      throw new BadRequestException(
        `Unsupported transaction type filter: ${type}.`,
      );
    }

    const take = Math.min(limit, 100);
    const skip = (page - 1) * take;
    const where = normalizedType
      ? { type: normalizedType as TransactionType }
      : undefined;
    const [data, total] = await Promise.all([
      this.prisma.transaction.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take,
        skip,
      }),
      this.prisma.transaction.count({ where }),
    ]);

    return {
      data: data.map((transaction) => this.mapTransaction(transaction)),
      meta: {
        total,
        page,
        limit: take,
        totalPages: Math.ceil(total / take),
        escrowTransactions: data.filter(
          (transaction) => transaction.type === TransactionType.ESCROW_HOLD,
        ).length,
        platformFeesCollected: data
          .filter(
            (transaction) => transaction.type === TransactionType.PLATFORM_FEE,
          )
          .reduce((sum, transaction) => sum + transaction.amount, 0),
        anomalies: data.filter(
          (transaction) =>
            transaction.type === TransactionType.ADJUSTMENT_NOTE ||
            (transaction.type === TransactionType.REFUND &&
              transaction.amount > 100000),
        ).length,
      },
    };
  }

  async generateReports(reportType: ReportType = 'overview', month?: string) {
    if (!REPORT_TYPES.includes(reportType)) {
      throw new BadRequestException(`Unsupported report type: ${reportType}.`);
    }

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
        const [userCount, jobStatusGroups, openDisputes, feeTotal, flaggedJobs, pendingArtisansCount, pendingPayoutsCount] =
          await Promise.all([
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
          ]);
        const jobMap = Object.fromEntries(
          jobStatusGroups.map((s) => [s.status, s._count.id]),
        );
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
          },
        };
        break;
      }
    }

    await this.logAction(
      'REPORT_GENERATED',
      AuditEntityType.REPORT,
      reportType,
      { id: 'system', role: 'ADMIN' },
      { reportType, month },
    );

    return {
      data: reportData,
      exportFormats: ['json', 'csv'],
    };
  }

  async getAuditLogs(page = 1, limit = 50) {
    const take = Math.min(limit, 100);
    const skip = (page - 1) * take;
    const [data, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        orderBy: { performedAt: 'desc' },
        take,
        skip,
      }),
      this.prisma.auditLog.count(),
    ]);

    return {
      data: data.map((log) => this.mapAuditLog(log)),
      meta: {
        total,
        page,
        limit: take,
        totalPages: Math.ceil(total / take),
      },
    };
  }

  async getAllContracts(search?: string, status?: string, page = 1, limit = 50) {
    const normalizedStatus = status?.toUpperCase();
    if (
      normalizedStatus &&
      !Object.values(ContractStatus).includes(normalizedStatus as ContractStatus)
    ) {
      throw new BadRequestException(
        `Unsupported contract status filter: ${status}.`,
      );
    }

    const take = Math.min(limit, 100);
    const skip = (page - 1) * take;

    const baseWhere: Prisma.ContractWhereInput = normalizedStatus
      ? { status: normalizedStatus as ContractStatus }
      : {};

    const where: Prisma.ContractWhereInput = search
      ? {
          ...baseWhere,
          OR: [
            { id: { equals: search } },
            { job: { title: { contains: search, mode: 'insensitive' } } },
            { client: { name: { contains: search, mode: 'insensitive' } } },
            { artisan: { name: { contains: search, mode: 'insensitive' } } },
          ],
        }
      : baseWhere;

    const [contracts, total] = await Promise.all([
      this.prisma.contract.findMany({
        where,
        include: {
          client: { select: { name: true, email: true } },
          artisan: { select: { name: true, email: true } },
          job: { select: { title: true } },
        },
        orderBy: { createdAt: 'desc' },
        take,
        skip,
      }),
      this.prisma.contract.count({ where }),
    ]);

    return {
      data: contracts.map((c) => ({
        ...c,
        clientName: c.client.name,
        artisanName: c.artisan.name,
        jobTitle: c.job.title,
      })),
      meta: {
        total,
        page,
        limit: take,
        totalPages: Math.ceil(total / take),
      },
    };
  }

  async getContractStats() {
    const escrowStatuses: ContractStatus[] = [
      ContractStatus.FUNDED,
      ContractStatus.ACTIVE,
      ContractStatus.IN_PROGRESS,
      ContractStatus.CLIENT_CONFIRMED,
      ContractStatus.READY_FOR_PAYOUT,
      ContractStatus.DISPUTED,
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
        where: { status: { in: escrowStatuses } },
        _sum: { amount: true },
        _count: { id: true },
      }),
      this.prisma.contract.aggregate({
        where: { status: ContractStatus.PAID_OUT },
        _sum: { amount: true },
      }),
      this.prisma.contract.aggregate({
        where: { status: ContractStatus.REFUNDED },
        _sum: { amount: true },
      }),
      this.prisma.contract.count(),
    ]);

    const statusDistribution = Object.fromEntries(
      statusGroups.map((s) => [s.status, s._count.id]),
    );
    const totalVolume = totalAgg._sum.amount ?? 0;

    return {
      totalCount,
      statusDistribution,
      totalVolume,
      escrowVolume: escrowAgg._sum.amount ?? 0,
      payoutVolume: payoutAgg._sum.amount ?? 0,
      refundVolume: refundAgg._sum.amount ?? 0,
      averageValue: totalCount > 0 ? totalVolume / totalCount : 0,
      activeContractCount: escrowAgg._count.id,
    };
  }

  private async findUser(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });
    if (!user) {
      throw new NotFoundException(`User ${userId} not found.`);
    }

    return user;
  }

  private async findDispute(disputeId: string) {
    const dispute = await this.prisma.dispute.findUnique({
      where: { id: disputeId },
      include: {
        history: {
          orderBy: { at: 'asc' },
        },
      },
    });
    if (!dispute) {
      throw new NotFoundException(`Dispute ${disputeId} not found.`);
    }

    return dispute;
  }

  private async findJob(jobId: string) {
    const job = await this.prisma.job.findUnique({
      where: { id: jobId },
    });
    if (!job) {
      throw new NotFoundException(`Job ${jobId} not found.`);
    }

    return job;
  }

  private async logAction(
    action: string,
    entityType: AuditEntityType,
    entityId: string,
    actor: AdminActor,
    metadata?: Record<string, string | number | boolean | undefined>,
  ) {
    await this.prisma.auditLog.create({
      data: {
        id: uuidv7(),
        action,
        entityType,
        entityId,
        performedBy: actor.id,
        performedAt: new Date(),
        metadata,
      },
    });
  }

  private ensureAdminIsProtected(
    user: AdminUserRecord,
    actor: AdminActor,
    action: 'ban' | 'update',
  ) {
    if (user.role === UserRole.ADMIN) {
      throw new BadRequestException(
        `Admin accounts cannot be targeted for ${action} actions.`,
      );
    }

    if (user.id === actor.id) {
      throw new BadRequestException(
        'Admin users cannot perform this action on themselves.',
      );
    }
  }

  private ensureSupportedDecision(
    decision: ResolveDisputeDecision | undefined,
  ) {
    if (!decision || !DISPUTE_DECISIONS.includes(decision as DisputeDecision)) {
      throw new BadRequestException(
        'Dispute decision must be REFUND_CLIENT or PAY_ARTISAN.',
      );
    }

    return decision as DisputeDecision;
  }

  private mapUser(user: AdminUserRecord) {
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      status: user.status,
      artisanVerified: user.artisanVerified,
      phone: user.phone,
      createdAt: user.createdAt.toISOString(),
    };
  }

  private mapDispute(dispute: AdminDisputeRecord) {
    return {
      id: dispute.id,
      contractId: dispute.contractId,
      jobId: dispute.jobId,
      clientId: dispute.clientId,
      artisanId: dispute.artisanId,
      amount: dispute.amount,
      status: dispute.status,
      createdAt: dispute.createdAt.toISOString(),
      evidence: {
        images: this.jsonStringArray(dispute.evidenceImages),
        videos: this.jsonStringArray(dispute.evidenceVideos),
        messages: this.jsonStringArray(dispute.evidenceMessages),
      },
      history: dispute.history.map((entry) => ({
        action: entry.action,
        at: entry.at.toISOString(),
        by: entry.by,
        notes: entry.notes ?? undefined,
      })),
      resolution: dispute.resolutionDecision
        ? {
            decision: dispute.resolutionDecision,
            resolvedAt: dispute.resolvedAt?.toISOString() ?? '',
            resolvedBy: dispute.resolvedBy ?? '',
            notes: dispute.resolutionNotes ?? undefined,
          }
        : undefined,
    };
  }

  private mapJob(job: AdminJobRecord) {
    return {
      id: job.id,
      title: job.title,
      contractId: job.contractId,
      clientId: job.clientId,
      artisanId: job.artisanId,
      amount: job.amount,
      status: job.status,
      flagged: job.flagged,
      forceClosedAt: job.forceClosedAt?.toISOString(),
      forceCloseReason: job.forceCloseReason ?? undefined,
    };
  }

  private mapTransaction(transaction: AdminTransactionRecord) {
    return {
      id: transaction.id,
      userId: transaction.userId,
      type: transaction.type,
      amount: transaction.amount,
      status: transaction.status,
      reference: transaction.reference,
      createdAt: transaction.createdAt.toISOString(),
    };
  }

  private mapAuditLog(log: AdminAuditLogRecord) {
    return {
      id: log.id,
      action: log.action,
      entityType: log.entityType,
      entityId: log.entityId,
      performedBy: log.performedBy,
      performedAt: log.performedAt.toISOString(),
      metadata: this.jsonRecord(log.metadata),
    };
  }

  private jsonStringArray(value: Prisma.JsonValue) {
    return Array.isArray(value)
      ? value
          .map((item) => this.normalizeJsonPrimitive(item))
          .filter((item): item is string => typeof item === 'string')
      : [];
  }

  private jsonRecord(value: Prisma.JsonValue | null) {
    if (!value || Array.isArray(value) || typeof value !== 'object') {
      return undefined;
    }

    return Object.fromEntries(
      Object.entries(value).map(([key, entry]) => [
        key,
        this.normalizeJsonPrimitive(entry),
      ]),
    );
  }

  private normalizeJsonPrimitive(value: Prisma.JsonValue | undefined) {
    if (
      typeof value === 'string' ||
      typeof value === 'number' ||
      typeof value === 'boolean' ||
      typeof value === 'undefined'
    ) {
      return value;
    }

    if (value === null) {
      return undefined;
    }

    return JSON.stringify(value);
  }

  private nextIdentifier(): string {
    return uuidv7();
  }
}
