import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AuthService } from '../auth/auth.service';
import {
  AuditEntityType,
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
  constructor(
    private readonly prisma: PrismaService,
    private readonly authService: AuthService,
  ) {}

  async getAllUsers() {
    const [data, active, banned] = await this.prisma.$transaction([
      this.prisma.user.findMany({
        orderBy: { createdAt: 'asc' },
      }),
      this.prisma.user.count({ where: { status: UserStatus.ACTIVE } }),
      this.prisma.user.count({ where: { status: UserStatus.BANNED } }),
    ]);

    return {
      data: data.map((user) => this.mapUser(user)),
      meta: {
        total: data.length,
        active,
        banned,
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

  async getAllDisputes() {
    const [disputes, active, resolved] = await this.prisma.$transaction([
      this.prisma.dispute.findMany({
        include: {
          history: {
            orderBy: { at: 'asc' },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.dispute.count({ where: { status: DisputeStatus.OPEN } }),
      this.prisma.dispute.count({ where: { status: DisputeStatus.RESOLVED } }),
    ]);

    return {
      data: disputes.map((dispute) => this.mapDispute(dispute)),
      meta: {
        total: disputes.length,
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
    const beneficiaryId =
      parsedDecision === DisputeDecision.REFUND_CLIENT
        ? dispute.clientId
        : dispute.artisanId;
    const transactionType =
      parsedDecision === DisputeDecision.REFUND_CLIENT
        ? TransactionType.REFUND
        : TransactionType.PAYOUT;
    const notificationMessage =
      parsedDecision === DisputeDecision.REFUND_CLIENT
        ? `A refund of NGN ${dispute.amount} has been approved for dispute ${dispute.id}.`
        : `A payout of NGN ${dispute.amount} has been approved for dispute ${dispute.id}.`;

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
          id: await this.nextIdentifier(tx, 'disputeHistory', 'dsh'),
          disputeId: dispute.id,
          action: 'DISPUTE_RESOLVED',
          at: resolvedAt,
          by: actor.id,
          notes,
        },
      });

      await tx.transaction.create({
        data: {
          id: await this.nextIdentifier(tx, 'transaction', 'txn'),
          userId: beneficiaryId,
          type: transactionType,
          amount: dispute.amount,
          status: TransactionStatus.COMPLETED,
          reference: `dispute_${dispute.id.toLowerCase()}`,
          createdAt: resolvedAt,
        },
      });

      await tx.notification.create({
        data: {
          id: await this.nextIdentifier(tx, 'notification', 'ntf'),
          userId: dispute.clientId,
          title: 'Dispute update',
          message: notificationMessage,
          createdAt: resolvedAt,
        },
      });

      await tx.notification.create({
        data: {
          id: await this.nextIdentifier(tx, 'notification', 'ntf'),
          userId: dispute.artisanId,
          title: 'Dispute update',
          message: notificationMessage,
          createdAt: resolvedAt,
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
          id: await this.nextIdentifier(tx, 'auditLog', 'log'),
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
          history: {
            orderBy: { at: 'asc' },
          },
        },
      });
    });

    return {
      message: `Dispute ${updatedDispute.id} resolved with decision ${parsedDecision}.`,
      data: this.mapDispute(updatedDispute),
      sideEffects: {
        walletTransactionRecorded: true,
        notificationsSent: 2,
        jobForceClosed: parsedDecision === DisputeDecision.REFUND_CLIENT,
      },
    };
  }

  async getAllJobs(status?: string) {
    const normalizedStatus = status?.toUpperCase();
    if (
      normalizedStatus &&
      !JOB_STATUSES.includes(normalizedStatus as JobStatus)
    ) {
      throw new BadRequestException(
        `Unsupported job status filter: ${status}.`,
      );
    }

    const where = normalizedStatus
      ? { status: normalizedStatus as JobStatus }
      : undefined;
    const [data, flagged] = await this.prisma.$transaction([
      this.prisma.job.findMany({
        where,
        orderBy: { createdAt: 'desc' },
      }),
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
        total: data.length,
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

  async getAllTransactions(type?: string) {
    const normalizedType = type?.toUpperCase();
    if (
      normalizedType &&
      !TRANSACTION_TYPES.includes(normalizedType as TransactionType)
    ) {
      throw new BadRequestException(
        `Unsupported transaction type filter: ${type}.`,
      );
    }

    const where = normalizedType
      ? { type: normalizedType as TransactionType }
      : undefined;
    const data = await this.prisma.transaction.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });

    return {
      data: data.map((transaction) => this.mapTransaction(transaction)),
      meta: {
        total: data.length,
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

    const [users, jobs, disputes, transactions] =
      await this.prisma.$transaction([
        this.prisma.user.findMany(),
        this.prisma.job.findMany(),
        this.prisma.dispute.findMany(),
        this.prisma.transaction.findMany(),
      ]);

    const reports = {
      jobs_per_month: {
        reportType: 'jobs_per_month',
        filters: { month: month ?? '2026-03' },
        totals: {
          jobsCreated: jobs.length,
          inProgress: jobs.filter((job) => job.status === JobStatus.IN_PROGRESS)
            .length,
          completed: jobs.filter((job) => job.status === JobStatus.COMPLETED)
            .length,
        },
      },
      platform_earnings: {
        reportType: 'platform_earnings',
        totals: {
          grossFees: transactions
            .filter(
              (transaction) =>
                transaction.type === TransactionType.PLATFORM_FEE,
            )
            .reduce((sum, transaction) => sum + transaction.amount, 0),
          generatedAt: new Date().toISOString(),
        },
      },
      active_disputes: {
        reportType: 'active_disputes',
        totals: {
          active: disputes.filter(
            (dispute) => dispute.status === DisputeStatus.OPEN,
          ).length,
          resolved: disputes.filter(
            (dispute) => dispute.status === DisputeStatus.RESOLVED,
          ).length,
        },
      },
      top_artisans: {
        reportType: 'top_artisans',
        data: users
          .filter((user) => user.role === UserRole.ARTISAN)
          .map((user) => ({
            artisanId: user.id,
            name: user.name,
            verified: user.artisanVerified,
            completedJobs: jobs.filter(
              (job) =>
                job.artisanId === user.id && job.status === JobStatus.COMPLETED,
            ).length,
            earnings: jobs
              .filter(
                (job) =>
                  job.artisanId === user.id &&
                  job.status === JobStatus.COMPLETED,
              )
              .reduce((sum, job) => sum + (job.amount || 0), 0),
          }))
          .sort((left, right) =>
            right.completedJobs === left.completedJobs
              ? right.earnings - left.earnings
              : right.completedJobs - left.completedJobs,
          ),
      },
      overview: {
        reportType: 'overview',
        totals: {
          users: users.length,
          activeJobs: jobs.filter((job) => job.status === JobStatus.IN_PROGRESS)
            .length,
          openDisputes: disputes.filter(
            (dispute) => dispute.status === DisputeStatus.OPEN,
          ).length,
          platformFees: transactions
            .filter(
              (transaction) =>
                transaction.type === TransactionType.PLATFORM_FEE,
            )
            .reduce((sum, transaction) => sum + transaction.amount, 0),
          flaggedJobs: jobs.filter((job) => job.flagged).length,
        },
      },
    } as const;

    await this.logAction(
      'REPORT_GENERATED',
      AuditEntityType.REPORT,
      reportType,
      { id: 'system', role: 'ADMIN' },
      { reportType, month },
    );

    return {
      data: reports[reportType],
      exportFormats: ['json', 'csv'],
    };
  }

  async getAuditLogs() {
    const data = await this.prisma.auditLog.findMany({
      orderBy: { performedAt: 'desc' },
    });

    return {
      data: data.map((log) => this.mapAuditLog(log)),
      meta: {
        total: data.length,
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
        id: await this.nextIdentifier(this.prisma, 'auditLog', 'log'),
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

  private async nextIdentifier(
    prisma: PrismaService | Prisma.TransactionClient,
    model: 'auditLog' | 'disputeHistory' | 'notification' | 'transaction',
    prefix: string,
  ) {
    let currentCount = 0;

    switch (model) {
      case 'auditLog':
        currentCount = await prisma.auditLog.count();
        break;
      case 'disputeHistory':
        currentCount = await prisma.disputeHistory.count();
        break;
      case 'notification':
        currentCount = await prisma.notification.count();
        break;
      case 'transaction':
        currentCount = await prisma.transaction.count();
        break;
    }

    return `${prefix}_${String(currentCount + 1).padStart(3, '0')}`;
  }
}
