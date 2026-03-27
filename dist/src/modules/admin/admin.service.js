"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AdminService = void 0;
const common_1 = require("@nestjs/common");
const auth_service_1 = require("../auth/auth.service");
const prisma_1 = require("../../generated/prisma");
const prisma_service_1 = require("../../database/prisma.service");
const REPORT_TYPES = [
    'jobs_per_month',
    'platform_earnings',
    'active_disputes',
    'top_artisans',
    'overview',
];
const JOB_STATUSES = Object.values(prisma_1.JobStatus);
const TRANSACTION_TYPES = Object.values(prisma_1.TransactionType);
const DISPUTE_DECISIONS = Object.values(prisma_1.DisputeDecision);
let AdminService = class AdminService {
    prisma;
    authService;
    constructor(prisma, authService) {
        this.prisma = prisma;
        this.authService = authService;
    }
    async getAllUsers() {
        const [data, active, banned] = await this.prisma.$transaction([
            this.prisma.user.findMany({
                orderBy: { createdAt: 'asc' },
            }),
            this.prisma.user.count({ where: { status: prisma_1.UserStatus.ACTIVE } }),
            this.prisma.user.count({ where: { status: prisma_1.UserStatus.BANNED } }),
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
    async banUser(userId, actor) {
        const user = await this.findUser(userId);
        this.ensureAdminIsProtected(user, actor, 'ban');
        if (user.status === prisma_1.UserStatus.BANNED) {
            throw new common_1.ConflictException(`User ${user.id} is already banned.`);
        }
        const updatedUser = await this.prisma.user.update({
            where: { id: user.id },
            data: { status: prisma_1.UserStatus.BANNED },
        });
        await this.logAction('USER_BANNED', prisma_1.AuditEntityType.USER, user.id, actor, {
            userStatus: updatedUser.status,
        });
        return {
            message: `User ${updatedUser.id} has been banned.`,
            data: this.mapUser(updatedUser),
        };
    }
    async unbanUser(userId, actor) {
        const user = await this.findUser(userId);
        if (user.status === prisma_1.UserStatus.ACTIVE) {
            throw new common_1.ConflictException(`User ${user.id} is already active.`);
        }
        const updatedUser = await this.prisma.user.update({
            where: { id: user.id },
            data: { status: prisma_1.UserStatus.ACTIVE },
        });
        await this.logAction('USER_UNBANNED', prisma_1.AuditEntityType.USER, user.id, actor, {
            userStatus: updatedUser.status,
        });
        return {
            message: `User ${updatedUser.id} has been restored.`,
            data: this.mapUser(updatedUser),
        };
    }
    async verifyArtisan(userId, actor) {
        const user = await this.findUser(userId);
        if (user.role !== prisma_1.UserRole.ARTISAN) {
            throw new common_1.BadRequestException('Only artisan accounts can be verified.');
        }
        if (user.artisanVerified) {
            throw new common_1.ConflictException(`Artisan ${user.id} is already verified.`);
        }
        const updatedUser = await this.prisma.user.update({
            where: { id: user.id },
            data: { artisanVerified: true },
        });
        await this.logAction('ARTISAN_VERIFIED', prisma_1.AuditEntityType.USER, user.id, actor, {
            artisanVerified: updatedUser.artisanVerified,
        });
        return {
            message: `Artisan ${updatedUser.id} verified successfully.`,
            data: this.mapUser(updatedUser),
        };
    }
    async resetUserPassword(userId, actor, expiresInMinutes) {
        const user = await this.findUser(userId);
        const requestedMinutes = typeof expiresInMinutes === 'number' ? expiresInMinutes : 30;
        if (requestedMinutes < 5 || requestedMinutes > 120) {
            throw new common_1.BadRequestException('Password reset tokens must expire between 5 and 120 minutes.');
        }
        const issuedReset = await this.authService.issueUserPasswordReset(user.id, requestedMinutes);
        await this.logAction('USER_PASSWORD_RESET', prisma_1.AuditEntityType.USER, user.id, actor, {
            resetWindowMinutes: requestedMinutes,
        });
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
            this.prisma.dispute.count({ where: { status: prisma_1.DisputeStatus.OPEN } }),
            this.prisma.dispute.count({ where: { status: prisma_1.DisputeStatus.RESOLVED } }),
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
    async resolveDispute(disputeId, decision, actor, notes) {
        const parsedDecision = this.ensureSupportedDecision(decision);
        const dispute = await this.findDispute(disputeId);
        if (dispute.status === prisma_1.DisputeStatus.RESOLVED) {
            throw new common_1.ConflictException(`Dispute ${dispute.id} has already been resolved.`);
        }
        const resolvedAt = new Date();
        const beneficiaryId = parsedDecision === prisma_1.DisputeDecision.REFUND_CLIENT
            ? dispute.clientId
            : dispute.artisanId;
        const transactionType = parsedDecision === prisma_1.DisputeDecision.REFUND_CLIENT
            ? prisma_1.TransactionType.REFUND
            : prisma_1.TransactionType.PAYOUT;
        const notificationMessage = parsedDecision === prisma_1.DisputeDecision.REFUND_CLIENT
            ? `A refund of NGN ${dispute.amount} has been approved for dispute ${dispute.id}.`
            : `A payout of NGN ${dispute.amount} has been approved for dispute ${dispute.id}.`;
        const updatedDispute = await this.prisma.$transaction(async (tx) => {
            await tx.dispute.update({
                where: { id: dispute.id },
                data: {
                    status: prisma_1.DisputeStatus.RESOLVED,
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
                    status: prisma_1.TransactionStatus.COMPLETED,
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
            if (parsedDecision === prisma_1.DisputeDecision.REFUND_CLIENT) {
                await tx.job.update({
                    where: { id: dispute.jobId },
                    data: {
                        status: prisma_1.JobStatus.FORCE_CLOSED,
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
                    entityType: prisma_1.AuditEntityType.DISPUTE,
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
                jobForceClosed: parsedDecision === prisma_1.DisputeDecision.REFUND_CLIENT,
            },
        };
    }
    async getAllJobs(status) {
        const normalizedStatus = status?.toUpperCase();
        if (normalizedStatus &&
            !JOB_STATUSES.includes(normalizedStatus)) {
            throw new common_1.BadRequestException(`Unsupported job status filter: ${status}.`);
        }
        const where = normalizedStatus
            ? { status: normalizedStatus }
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
    async forceCloseJob(jobId, actor, reason) {
        const job = await this.findJob(jobId);
        if (job.status === prisma_1.JobStatus.FORCE_CLOSED) {
            throw new common_1.ConflictException(`Job ${job.id} has already been force-closed.`);
        }
        if (job.status === prisma_1.JobStatus.COMPLETED) {
            throw new common_1.BadRequestException(`Job ${job.id} is already completed and cannot be force-closed.`);
        }
        const resolvedReason = reason?.trim() || 'Suspicious activity detected by admin review.';
        const updatedJob = await this.prisma.job.update({
            where: { id: job.id },
            data: {
                status: prisma_1.JobStatus.FORCE_CLOSED,
                flagged: true,
                forceClosedAt: new Date(),
                forceCloseReason: resolvedReason,
            },
        });
        await this.logAction('JOB_FORCE_CLOSED', prisma_1.AuditEntityType.JOB, job.id, actor, {
            reason: resolvedReason,
        });
        return {
            message: `Job ${updatedJob.id} has been force-closed.`,
            data: this.mapJob(updatedJob),
        };
    }
    async getAllTransactions(type) {
        const normalizedType = type?.toUpperCase();
        if (normalizedType &&
            !TRANSACTION_TYPES.includes(normalizedType)) {
            throw new common_1.BadRequestException(`Unsupported transaction type filter: ${type}.`);
        }
        const where = normalizedType
            ? { type: normalizedType }
            : undefined;
        const data = await this.prisma.transaction.findMany({
            where,
            orderBy: { createdAt: 'desc' },
        });
        return {
            data: data.map((transaction) => this.mapTransaction(transaction)),
            meta: {
                total: data.length,
                escrowTransactions: data.filter((transaction) => transaction.type === prisma_1.TransactionType.ESCROW_HOLD).length,
                platformFeesCollected: data
                    .filter((transaction) => transaction.type === prisma_1.TransactionType.PLATFORM_FEE)
                    .reduce((sum, transaction) => sum + transaction.amount, 0),
                anomalies: data.filter((transaction) => transaction.type === prisma_1.TransactionType.ADJUSTMENT_NOTE ||
                    (transaction.type === prisma_1.TransactionType.REFUND &&
                        transaction.amount > 100000)).length,
            },
        };
    }
    async generateReports(reportType = 'overview', month) {
        if (!REPORT_TYPES.includes(reportType)) {
            throw new common_1.BadRequestException(`Unsupported report type: ${reportType}.`);
        }
        const [users, jobs, disputes, transactions] = await this.prisma.$transaction([
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
                    inProgress: jobs.filter((job) => job.status === prisma_1.JobStatus.IN_PROGRESS)
                        .length,
                    completed: jobs.filter((job) => job.status === prisma_1.JobStatus.COMPLETED)
                        .length,
                },
            },
            platform_earnings: {
                reportType: 'platform_earnings',
                totals: {
                    grossFees: transactions
                        .filter((transaction) => transaction.type === prisma_1.TransactionType.PLATFORM_FEE)
                        .reduce((sum, transaction) => sum + transaction.amount, 0),
                    generatedAt: new Date().toISOString(),
                },
            },
            active_disputes: {
                reportType: 'active_disputes',
                totals: {
                    active: disputes.filter((dispute) => dispute.status === prisma_1.DisputeStatus.OPEN).length,
                    resolved: disputes.filter((dispute) => dispute.status === prisma_1.DisputeStatus.RESOLVED).length,
                },
            },
            top_artisans: {
                reportType: 'top_artisans',
                data: users
                    .filter((user) => user.role === prisma_1.UserRole.ARTISAN)
                    .map((user) => ({
                    artisanId: user.id,
                    name: user.name,
                    verified: user.artisanVerified,
                    completedJobs: jobs.filter((job) => job.artisanId === user.id && job.status === prisma_1.JobStatus.COMPLETED).length,
                    earnings: jobs
                        .filter((job) => job.artisanId === user.id &&
                        job.status === prisma_1.JobStatus.COMPLETED)
                        .reduce((sum, job) => sum + job.amount, 0),
                }))
                    .sort((left, right) => right.completedJobs === left.completedJobs
                    ? right.earnings - left.earnings
                    : right.completedJobs - left.completedJobs),
            },
            overview: {
                reportType: 'overview',
                totals: {
                    users: users.length,
                    activeJobs: jobs.filter((job) => job.status === prisma_1.JobStatus.IN_PROGRESS)
                        .length,
                    openDisputes: disputes.filter((dispute) => dispute.status === prisma_1.DisputeStatus.OPEN).length,
                    platformFees: transactions
                        .filter((transaction) => transaction.type === prisma_1.TransactionType.PLATFORM_FEE)
                        .reduce((sum, transaction) => sum + transaction.amount, 0),
                    flaggedJobs: jobs.filter((job) => job.flagged).length,
                },
            },
        };
        await this.logAction('REPORT_GENERATED', prisma_1.AuditEntityType.REPORT, reportType, { id: 'system', role: 'ADMIN' }, { reportType, month });
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
    async findUser(userId) {
        const user = await this.prisma.user.findUnique({
            where: { id: userId },
        });
        if (!user) {
            throw new common_1.NotFoundException(`User ${userId} not found.`);
        }
        return user;
    }
    async findDispute(disputeId) {
        const dispute = await this.prisma.dispute.findUnique({
            where: { id: disputeId },
            include: {
                history: {
                    orderBy: { at: 'asc' },
                },
            },
        });
        if (!dispute) {
            throw new common_1.NotFoundException(`Dispute ${disputeId} not found.`);
        }
        return dispute;
    }
    async findJob(jobId) {
        const job = await this.prisma.job.findUnique({
            where: { id: jobId },
        });
        if (!job) {
            throw new common_1.NotFoundException(`Job ${jobId} not found.`);
        }
        return job;
    }
    async logAction(action, entityType, entityId, actor, metadata) {
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
    ensureAdminIsProtected(user, actor, action) {
        if (user.role === prisma_1.UserRole.ADMIN) {
            throw new common_1.BadRequestException(`Admin accounts cannot be targeted for ${action} actions.`);
        }
        if (user.id === actor.id) {
            throw new common_1.BadRequestException('Admin users cannot perform this action on themselves.');
        }
    }
    ensureSupportedDecision(decision) {
        if (!decision || !DISPUTE_DECISIONS.includes(decision)) {
            throw new common_1.BadRequestException('Dispute decision must be REFUND_CLIENT or PAY_ARTISAN.');
        }
        return decision;
    }
    mapUser(user) {
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
    mapDispute(dispute) {
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
    mapJob(job) {
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
    mapTransaction(transaction) {
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
    mapAuditLog(log) {
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
    jsonStringArray(value) {
        return Array.isArray(value) ? value.map((item) => String(item)) : [];
    }
    jsonRecord(value) {
        if (!value || Array.isArray(value) || typeof value !== 'object') {
            return undefined;
        }
        return Object.fromEntries(Object.entries(value).map(([key, entry]) => [
            key,
            this.normalizeJsonPrimitive(entry),
        ]));
    }
    normalizeJsonPrimitive(value) {
        if (typeof value === 'string' ||
            typeof value === 'number' ||
            typeof value === 'boolean' ||
            typeof value === 'undefined') {
            return value;
        }
        if (value === null) {
            return undefined;
        }
        return JSON.stringify(value);
    }
    async nextIdentifier(prisma, model, prefix) {
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
};
exports.AdminService = AdminService;
exports.AdminService = AdminService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        auth_service_1.AuthService])
], AdminService);
//# sourceMappingURL=admin.service.js.map