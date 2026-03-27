import { AuthService } from '../auth/auth.service';
import { DisputeDecision } from '../../generated/prisma';
import { PrismaService } from '../../database/prisma.service';
type AdminActor = {
    id: string;
    role: string;
};
export type ResolveDisputeDecision = keyof typeof DisputeDecision;
export type ReportType = 'jobs_per_month' | 'platform_earnings' | 'active_disputes' | 'top_artisans' | 'overview';
export declare class AdminService {
    private readonly prisma;
    private readonly authService;
    constructor(prisma: PrismaService, authService: AuthService);
    getAllUsers(): Promise<{
        data: {
            id: string;
            name: string;
            email: string;
            role: import("../../generated/prisma").$Enums.UserRole;
            status: import("../../generated/prisma").$Enums.UserStatus;
            artisanVerified: boolean;
            createdAt: string;
        }[];
        meta: {
            total: number;
            active: number;
            banned: number;
        };
    }>;
    banUser(userId: string, actor: AdminActor): Promise<{
        message: string;
        data: {
            id: string;
            name: string;
            email: string;
            role: import("../../generated/prisma").$Enums.UserRole;
            status: import("../../generated/prisma").$Enums.UserStatus;
            artisanVerified: boolean;
            createdAt: string;
        };
    }>;
    unbanUser(userId: string, actor: AdminActor): Promise<{
        message: string;
        data: {
            id: string;
            name: string;
            email: string;
            role: import("../../generated/prisma").$Enums.UserRole;
            status: import("../../generated/prisma").$Enums.UserStatus;
            artisanVerified: boolean;
            createdAt: string;
        };
    }>;
    verifyArtisan(userId: string, actor: AdminActor): Promise<{
        message: string;
        data: {
            id: string;
            name: string;
            email: string;
            role: import("../../generated/prisma").$Enums.UserRole;
            status: import("../../generated/prisma").$Enums.UserStatus;
            artisanVerified: boolean;
            createdAt: string;
        };
    }>;
    resetUserPassword(userId: string, actor: AdminActor, expiresInMinutes?: number): Promise<{
        message: string;
        data: {
            userId: string;
            resetToken: string;
            expiresAt: string;
        };
    }>;
    getAllDisputes(): Promise<{
        data: {
            id: string;
            contractId: string;
            jobId: string;
            clientId: string;
            artisanId: string;
            amount: number;
            status: import("../../generated/prisma").$Enums.DisputeStatus;
            evidence: {
                images: string[];
                videos: string[];
                messages: string[];
            };
            history: {
                action: string;
                at: string;
                by: string;
                notes: string | undefined;
            }[];
            resolution: {
                decision: import("../../generated/prisma").$Enums.DisputeDecision;
                resolvedAt: string;
                resolvedBy: string;
                notes: string | undefined;
            } | undefined;
        }[];
        meta: {
            total: number;
            active: number;
            resolved: number;
        };
    }>;
    resolveDispute(disputeId: string, decision: ResolveDisputeDecision, actor: AdminActor, notes?: string): Promise<{
        message: string;
        data: {
            id: string;
            contractId: string;
            jobId: string;
            clientId: string;
            artisanId: string;
            amount: number;
            status: import("../../generated/prisma").$Enums.DisputeStatus;
            evidence: {
                images: string[];
                videos: string[];
                messages: string[];
            };
            history: {
                action: string;
                at: string;
                by: string;
                notes: string | undefined;
            }[];
            resolution: {
                decision: import("../../generated/prisma").$Enums.DisputeDecision;
                resolvedAt: string;
                resolvedBy: string;
                notes: string | undefined;
            } | undefined;
        };
        sideEffects: {
            walletTransactionRecorded: boolean;
            notificationsSent: number;
            jobForceClosed: boolean;
        };
    }>;
    getAllJobs(status?: string): Promise<{
        data: {
            id: string;
            title: string;
            contractId: string;
            clientId: string;
            artisanId: string;
            amount: number;
            status: import("../../generated/prisma").$Enums.JobStatus;
            flagged: boolean;
            forceClosedAt: string | undefined;
            forceCloseReason: string | undefined;
        }[];
        meta: {
            total: number;
            flagged: number;
        };
    }>;
    forceCloseJob(jobId: string, actor: AdminActor, reason?: string): Promise<{
        message: string;
        data: {
            id: string;
            title: string;
            contractId: string;
            clientId: string;
            artisanId: string;
            amount: number;
            status: import("../../generated/prisma").$Enums.JobStatus;
            flagged: boolean;
            forceClosedAt: string | undefined;
            forceCloseReason: string | undefined;
        };
    }>;
    getAllTransactions(type?: string): Promise<{
        data: {
            id: string;
            userId: string;
            type: import("../../generated/prisma").$Enums.TransactionType;
            amount: number;
            status: "COMPLETED";
            reference: string;
            createdAt: string;
        }[];
        meta: {
            total: number;
            escrowTransactions: number;
            platformFeesCollected: number;
            anomalies: number;
        };
    }>;
    generateReports(reportType?: ReportType, month?: string): Promise<{
        data: {
            readonly reportType: "jobs_per_month";
            readonly filters: {
                readonly month: string;
            };
            readonly totals: {
                readonly jobsCreated: number;
                readonly inProgress: number;
                readonly completed: number;
            };
        } | {
            readonly reportType: "platform_earnings";
            readonly totals: {
                readonly grossFees: number;
                readonly generatedAt: string;
            };
        } | {
            readonly reportType: "active_disputes";
            readonly totals: {
                readonly active: number;
                readonly resolved: number;
            };
        } | {
            readonly reportType: "top_artisans";
            readonly data: {
                artisanId: string;
                name: string;
                verified: boolean;
                completedJobs: number;
                earnings: number;
            }[];
        } | {
            readonly reportType: "overview";
            readonly totals: {
                readonly users: number;
                readonly activeJobs: number;
                readonly openDisputes: number;
                readonly platformFees: number;
                readonly flaggedJobs: number;
            };
        };
        exportFormats: string[];
    }>;
    getAuditLogs(): Promise<{
        data: {
            id: string;
            action: string;
            entityType: import("../../generated/prisma").$Enums.AuditEntityType;
            entityId: string;
            performedBy: string;
            performedAt: string;
            metadata: {
                [k: string]: string | number | boolean | undefined;
            } | undefined;
        }[];
        meta: {
            total: number;
        };
    }>;
    private findUser;
    private findDispute;
    private findJob;
    private logAction;
    private ensureAdminIsProtected;
    private ensureSupportedDecision;
    private mapUser;
    private mapDispute;
    private mapJob;
    private mapTransaction;
    private mapAuditLog;
    private jsonStringArray;
    private jsonRecord;
    private normalizeJsonPrimitive;
    private nextIdentifier;
}
export {};
