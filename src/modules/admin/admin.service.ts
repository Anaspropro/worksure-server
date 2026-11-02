import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { v7 as uuidv7 } from 'uuid';
import { reputationQueue } from '../../queue/queue';
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
  ReviewStatus,
} from '../../generated/prisma';
import { PrismaService } from '../../database/prisma.service';
import { RedisCacheService } from '../../common/cache/redis-cache.service';
import { EventEmitter2 } from '@nestjs/event-emitter';

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
  include: {
    history: { orderBy: { at: 'asc' } };
    contract: { select: { jobId: true } };
    evidence: true;
  };
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
    private readonly cacheService: RedisCacheService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async getAllUsers(
    search?: string,
    role?: UserRole,
    cursor?: string,
    limit = 50,
  ) {
    const take = Math.min(limit, 100);

    const baseWhere: Prisma.UserWhereInput = role ? { role } : {};

    const where: Prisma.UserWhereInput = search
      ? {
          ...baseWhere,
          OR: [
            { name: { contains: search, mode: 'insensitive' } },
            { email: { contains: search, mode: 'insensitive' } },
          ],
        }
      : baseWhere;

    const data = await this.prisma.user.findMany({
      where,
      orderBy: { createdAt: 'asc' },
      take: take + 1,
      include: {
        artisanProfile: true,
        clientContracts: {
          select: { amount: true, status: true },
        },
        _count: {
          select: { clientJobs: true },
        },
      },
      ...(cursor && {
        cursor: { id: cursor },
        skip: 1,
      }),
    });

    const statusGroups = cursor
      ? []
      : await this.prisma.user.groupBy({
          by: ['status'],
          where,
          _count: { id: true },
        });

    let nextCursor: string | undefined = undefined;
    if (data.length > take) {
      const nextItem = data.pop();
      nextCursor = nextItem?.id;
    }

    const statusMap = Object.fromEntries(
      statusGroups.map((g) => [g.status, g._count.id]),
    );
    const total = statusGroups.reduce((s, g) => s + g._count.id, 0);

    return {
      data: data.map((user) => this.mapUser(user)),
      meta: {
        total,
        limit: take,
        nextCursor,
        active: statusMap['ACTIVE'] ?? 0,
        banned: statusMap['BANNED'] ?? 0,
      },
    };
  }

  async getUserDetail(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        status: true,
        artisanVerified: true,
        emailVerified: true,
        paystackRecipientCode: true,
        payoutBankCode: true,
        payoutAccountNumber: true,
        payoutAccountName: true,
        phone: true,
        createdAt: true,
        updatedAt: true,
        lastLoginAt: true,
        artisanProfile: {
          select: {
            bio: true,
            skills: true,
            experience: true,
            portfolio: true,
            verified: true,
            rating: true,
            reviewCount: true,
            updatedAt: true,
          },
        },
        ledgerAccounts: {
          select: { balance: true, frozen: true, updatedAt: true },
        },
        transactions: {
          select: {
            id: true,
            userId: true,
            type: true,
            amount: true,
            status: true,
            reference: true,
            createdAt: true,
          },
          orderBy: { createdAt: 'desc' },
          take: 10,
        },
        notifications: {
          select: { id: true, category: true, type: true, createdAt: true },
          orderBy: { createdAt: 'desc' },
          take: 5,
        },
        clientJobs: {
          select: {
            id: true,
            title: true,
            contractId: true,
            clientId: true,
            artisanId: true,
            amount: true,
            status: true,
            flagged: true,
            forceClosedAt: true,
            forceCloseReason: true,
            createdAt: true,
          },
          orderBy: { createdAt: 'desc' },
          take: 5,
        },
        artisanJobs: {
          select: {
            id: true,
            title: true,
            contractId: true,
            clientId: true,
            artisanId: true,
            amount: true,
            status: true,
            flagged: true,
            forceClosedAt: true,
            forceCloseReason: true,
            createdAt: true,
          },
          orderBy: { createdAt: 'desc' },
          take: 5,
        },
        clientContracts: {
          select: { id: true, amount: true, status: true, createdAt: true },
          orderBy: { createdAt: 'desc' },
          take: 5,
        },
        artisanContracts: {
          select: { id: true, amount: true, status: true, createdAt: true },
          orderBy: { createdAt: 'desc' },
          take: 5,
        },
        authoredReviews: {
          select: { id: true, rating: true, comment: true, createdAt: true },
          orderBy: { createdAt: 'desc' },
          take: 5,
        },
        receivedReviews: {
          select: { id: true, rating: true, comment: true, createdAt: true },
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
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        status: user.status,
        artisanVerified: user.artisanVerified,
        phone: user.phone ?? null,

        createdAt: user.createdAt.toISOString(),
        lastLoginAt: user.lastLoginAt?.toISOString() ?? null,
        updatedAt: user.updatedAt.toISOString(),
        wallet: user.ledgerAccounts
          ? {
              balance: user.ledgerAccounts.balance,
              frozen: user.ledgerAccounts.frozen,
              available:
                user.ledgerAccounts.balance - user.ledgerAccounts.frozen,
              updatedAt: user.ledgerAccounts.updatedAt.toISOString(),
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
        clientProfile: {
          companyName: null,
          totalJobs: user.clientJobs?.length ?? 0,
          totalSpent: user.clientContracts
            ? user.clientContracts.reduce((sum, c) => sum + (c.amount || 0), 0)
            : 0,
        },
        transactions: user.transactions.map((transaction) =>
          this.mapTransaction(transaction as any),
        ),
        notifications: user.notifications.map((notification) => ({
          id: notification.id,
          category: notification.category,
          type: notification.type,
          createdAt: notification.createdAt.toISOString(),
        })),
        activity: {
          clientJobs: user.clientJobs.map((job) => this.mapJob(job as any)),
          artisanJobs: user.artisanJobs.map((job) => this.mapJob(job as any)),
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
          authoredReviews: user.authoredReviews.map((review) => ({
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

    await this.cacheService.invalidatePattern('*admin/users*');
    await this.cacheService.invalidatePattern('analytics:report:*');

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

    await this.cacheService.invalidatePattern('*admin/users*');
    await this.cacheService.invalidatePattern('analytics:report:*');

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

    await this.prisma.artisanProfile.updateMany({
      where: { userId: user.id },
      data: { verified: true },
    });

    await this.prisma.artisanVerification.updateMany({
      where: { userId: user.id },
      data: {
        marketplaceStatus: 'APPROVED',
        marketplaceApprovedAt: new Date(),
      },
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

    await this.cacheService.invalidatePattern('*admin/users*');
    await this.cacheService.invalidatePattern('analytics:report:*');

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

    this.eventEmitter.emit('marketplace.verification.rejected', {
      userId: user.id,
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

    await this.cacheService.invalidatePattern('*admin/users*');
    await this.cacheService.invalidatePattern('analytics:report:*');

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

  async getAllDisputes(cursor?: string, limit = 50) {
    const take = Math.min(limit, 100);
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
        take: take + 1,
        ...(cursor && {
          cursor: { id: cursor },
          skip: 1,
        }),
      }),
      this.prisma.dispute.count(),
      this.prisma.dispute.count({ where: { status: DisputeStatus.OPEN } }),
      this.prisma.dispute.count({ where: { status: DisputeStatus.RESOLVED } }),
    ]);

    let nextCursor: string | undefined = undefined;
    if (disputes.length > take) {
      const nextItem = disputes.pop();
      nextCursor = nextItem?.id;
    }

    return {
      data: disputes.map((dispute: any) => ({
        ...this.mapDispute(dispute),
        clientName: dispute.client.name,
        artisanName: dispute.artisan.name,
        contractTitle: dispute.contract?.job.title ?? 'Untitled Contract',
      })),
      meta: {
        total,
        limit: take,
        nextCursor,
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
      parsedDecision === DisputeDecision.CLIENT_WINS
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

      if (
        parsedDecision === DisputeDecision.CLIENT_WINS &&
        dispute.contract?.jobId
      ) {
        await tx.job.update({
          where: { id: dispute.contract.jobId },
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
        include: {
          history: { orderBy: { at: 'asc' } },
          contract: { select: { jobId: true } },
          evidence: true,
        },
      });
    });

    // Step 2: Route fund movement through the real payment service
    // This ensures actual escrow/refund logic runs (Paystack, ledger, wallet).
    let fundMovementSucceeded = false;
    try {
      if (!dispute.contractId) {
        throw new BadRequestException(
          'Dispute is not associated with a contract',
        );
      }

      if (parsedDecision === DisputeDecision.CLIENT_WINS) {
        await this.paymentsService.refundContract(
          dispute.contractId,
          actor.id,
          true, // isAdmin = true
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
    this.eventEmitter.emit('dispute.resolved', {
      disputeId: dispute.id,
      decision: parsedDecision,
      clientId: dispute.clientId,
      artisanId: dispute.artisanId,
    });

    await this.cacheService.invalidatePattern('*admin/disputes*');
    await this.cacheService.invalidatePattern('*admin/jobs*');
    await this.cacheService.invalidatePattern('*admin/transactions*');
    await this.cacheService.invalidatePattern('*admin/contracts*');
    await this.cacheService.invalidatePattern('analytics:report:*');
    await this.cacheService.invalidatePattern('analytics:contract:stats');

    return {
      message: `Dispute ${updatedDispute.id} resolved with decision ${parsedDecision}.`,
      data: this.mapDispute(updatedDispute),
      sideEffects: {
        fundMovementTriggered: fundMovementSucceeded,
        notificationsSent: 2,
        jobForceClosed: parsedDecision === DisputeDecision.CLIENT_WINS,
      },
    };
  }

  async getAllJobs(
    search?: string,
    status?: string,
    cursor?: string,
    limit = 50,
  ) {
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

    const data = await this.prisma.job.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: take + 1,
      ...(cursor && {
        cursor: { id: cursor },
        skip: 1,
      }),
    });

    const total = cursor ? 0 : await this.prisma.job.count({ where });
    const flagged = cursor
      ? 0
      : await this.prisma.job.count({ where: { ...where, flagged: true } });

    let nextCursor: string | undefined = undefined;
    if (data.length > take) {
      const nextItem = data.pop();
      nextCursor = nextItem?.id;
    }

    return {
      data: data.map((job) => this.mapJob(job)),
      meta: {
        total,
        limit: take,
        nextCursor,
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

    await this.cacheService.invalidatePattern('*admin/jobs*');
    await this.cacheService.invalidatePattern('analytics:report:*');

    return {
      message: `Job ${updatedJob.id} has been force-closed.`,
      data: this.mapJob(updatedJob),
    };
  }

  async getAllTransactions(type?: string, cursor?: string, limit = 50) {
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
    const where = normalizedType
      ? { type: normalizedType as TransactionType }
      : undefined;
    const data = await this.prisma.transaction.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: take + 1,
      ...(cursor && {
        cursor: { id: cursor },
        skip: 1,
      }),
    });

    const total = cursor ? 0 : await this.prisma.transaction.count({ where });

    let nextCursor: string | undefined = undefined;
    if (data.length > take) {
      const nextItem = data.pop();
      nextCursor = nextItem?.id;
    }

    return {
      data: data.map((transaction) => this.mapTransaction(transaction)),
      meta: {
        total,
        limit: take,
        nextCursor,
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

  async getAuditLogs(cursor?: string, limit = 50) {
    const take = Math.min(limit, 100);
    const [data, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        orderBy: { performedAt: 'desc' },
        take: take + 1,
        ...(cursor && {
          cursor: { id: cursor },
          skip: 1,
        }),
      }),
      this.prisma.auditLog.count(),
    ]);

    let nextCursor: string | undefined = undefined;
    if (data.length > take) {
      const nextItem = data.pop();
      nextCursor = nextItem?.id;
    }

    return {
      data: data.map((log) => this.mapAuditLog(log)),
      meta: {
        total,
        limit: take,
        nextCursor,
      },
    };
  }

  async getAllReviews(
    search?: string,
    status?: string,
    cursor?: string,
    limit = 50,
  ) {
    const normalizedStatus = status?.toUpperCase();
    if (
      normalizedStatus &&
      !Object.values(ReviewStatus).includes(normalizedStatus as ReviewStatus)
    ) {
      throw new BadRequestException(
        `Unsupported review status filter: ${status}`,
      );
    }

    const take = Math.min(limit, 100);

    const baseWhere: Prisma.ReviewWhereInput = normalizedStatus
      ? { status: normalizedStatus as ReviewStatus }
      : {};

    // Search can target author or target names. We don't have review text search here yet unless requested.
    const where: Prisma.ReviewWhereInput = search
      ? {
          ...baseWhere,
          OR: [
            { id: { equals: search } },
            { author: { name: { contains: search, mode: 'insensitive' } } },
            { target: { name: { contains: search, mode: 'insensitive' } } },
          ],
        }
      : baseWhere;

    const [reviews, total] = await Promise.all([
      this.prisma.review.findMany({
        where,
        include: {
          author: { select: { name: true, email: true } },
          target: { select: { name: true, email: true } },
          contract: { select: { job: { select: { title: true } } } },
        },
        orderBy: { createdAt: 'desc' },
        take: take + 1,
        ...(cursor && {
          cursor: { id: cursor },
          skip: 1,
        }),
      }),
      this.prisma.review.count({ where }),
    ]);

    let nextCursor: string | undefined = undefined;
    if (reviews.length > take) {
      const nextItem = reviews.pop();
      nextCursor = nextItem?.id;
    }

    return {
      data: reviews.map((r) => ({
        ...r,
        authorName: r.author.name,
        targetName: r.target.name,
        jobTitle: r.contract?.job?.title,
      })),
      meta: {
        total,
        limit: take,
        nextCursor,
      },
    };
  }

  async moderateReview(
    reviewId: string,
    action: 'FLAG' | 'LOCK' | 'RESTORE',
    actor: AdminActor,
    reason?: string,
  ) {
    const review = await this.prisma.review.findUnique({
      where: { id: reviewId },
    });

    if (!review) {
      throw new NotFoundException(`Review ${reviewId} not found.`);
    }

    let newStatus: ReviewStatus;
    if (action === 'FLAG') newStatus = ReviewStatus.FLAGGED;
    else if (action === 'LOCK') newStatus = ReviewStatus.LOCKED;
    else newStatus = ReviewStatus.VISIBLE;

    const updatedReview = await this.prisma.review.update({
      where: { id: reviewId },
      data: { status: newStatus },
    });

    // We must recalculate the JSS score of the target because this review
    // might have been removed from or added back to their active Visible reviews.
    await reputationQueue.add('calculateReputation', {
      userId: review.targetId,
    });

    await this.logAction(
      `REVIEW_${action}ED`, // e.g., REVIEW_LOCKED
      AuditEntityType.CONTRACT, // Assuming Review is part of Contract lifecycle
      reviewId,
      actor,
      {
        reason,
        targetId: review.targetId,
        authorId: review.authorId,
      },
    );

    return { data: updatedReview };
  }

  async getAllContracts(
    search?: string,
    status?: string,
    cursor?: string,
    limit = 50,
  ) {
    const normalizedStatus = status?.toUpperCase();
    if (
      normalizedStatus &&
      !Object.values(ContractStatus).includes(
        normalizedStatus as ContractStatus,
      )
    ) {
      throw new BadRequestException(
        `Unsupported contract status filter: ${status}.`,
      );
    }

    const take = Math.min(limit, 100);

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
        take: take + 1,
        ...(cursor && {
          cursor: { id: cursor },
          skip: 1,
        }),
      }),
      this.prisma.contract.count({ where }),
    ]);

    let nextCursor: string | undefined = undefined;
    if (contracts.length > take) {
      const nextItem = contracts.pop();
      nextCursor = nextItem?.id;
    }

    return {
      data: contracts.map((c) => ({
        ...c,
        clientName: c.client.name,
        artisanName: c.artisan.name,
        jobTitle: c.job.title,
      })),
      meta: {
        total,
        limit: take,
        nextCursor,
      },
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
        contract: {
          select: { jobId: true },
        },
        evidence: true,
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
    if (!decision || !DISPUTE_DECISIONS.includes(decision)) {
      throw new BadRequestException(
        'Dispute decision must be CLIENT_WINS or ARTISAN_WINS.',
      );
    }

    return decision;
  }

  private mapUser(user: any) {
    const totalSpent = user.clientContracts
      ? user.clientContracts.reduce(
          (sum: number, c: any) => sum + (c.amount || 0),
          0,
        )
      : 0;

    return {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      status: user.status,
      artisanVerified: user.artisanVerified,
      phone: user.phone,
      createdAt: user.createdAt.toISOString(),
      artisanProfile: user.artisanProfile,
      clientProfile: {
        companyName: null,
        totalJobs: user._count?.clientJobs ?? 0,
        totalSpent,
      },
    };
  }

  private mapDispute(dispute: AdminDisputeRecord) {
    return {
      id: dispute.id,
      contractId: dispute.contractId,
      jobId: dispute.contract?.jobId,
      clientId: dispute.clientId,
      artisanId: dispute.artisanId,
      amount: dispute.amount,
      status: dispute.status,
      createdAt: dispute.createdAt.toISOString(),
      evidence: dispute.evidence,
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
      createdAt: job.createdAt?.toISOString(),
      updatedAt: job.updatedAt?.toISOString(),
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

  async getSystemConfig() {
    const configs = await this.prisma.systemConfig.findMany({
      orderBy: { key: 'asc' },
    });
    return { data: configs };
  }

  async updateSystemConfig(
    key: string,
    value: any,
    actor: AdminActor,
    description?: string,
  ) {
    const config = await this.prisma.systemConfig.upsert({
      where: { key },
      update: {
        value,
        description: description ?? undefined,
        updatedBy: actor.id,
      },
      create: {
        id: uuidv7(),
        key,
        value,
        description,
        updatedBy: actor.id,
      },
    });

    await this.logAction(
      'CONFIG_UPDATED',
      AuditEntityType.USER,
      'SYSTEM',
      actor,
      {
        key,
        value,
      },
    );

    await this.cacheService.invalidatePattern('*admin/config*');
    return { data: config };
  }
}
