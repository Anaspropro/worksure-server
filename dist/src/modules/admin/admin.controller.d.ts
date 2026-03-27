import { UserRole } from '../../common/constants/roles.constants';
import { AdminResetPasswordDto } from './dto/admin-reset-password.dto';
import { ForceCloseJobDto } from './dto/force-close-job.dto';
import { ResolveDisputeDto } from './dto/resolve-dispute.dto';
import { AdminService, ReportType } from './admin.service';
export declare class AdminController {
    private readonly adminService;
    constructor(adminService: AdminService);
    getAllUsers(): Promise<{
        data: {
            id: string;
            name: string;
            email: string;
            role: import("src/generated/prisma").$Enums.UserRole;
            status: import("src/generated/prisma").$Enums.UserStatus;
            artisanVerified: boolean;
            createdAt: string;
        }[];
        meta: {
            total: number;
            active: number;
            banned: number;
        };
    }>;
    banUser(userId: string, adminUser: {
        sub: string;
        role: UserRole;
    }): Promise<{
        message: string;
        data: {
            id: string;
            name: string;
            email: string;
            role: import("src/generated/prisma").$Enums.UserRole;
            status: import("src/generated/prisma").$Enums.UserStatus;
            artisanVerified: boolean;
            createdAt: string;
        };
    }>;
    unbanUser(userId: string, adminUser: {
        sub: string;
        role: UserRole;
    }): Promise<{
        message: string;
        data: {
            id: string;
            name: string;
            email: string;
            role: import("src/generated/prisma").$Enums.UserRole;
            status: import("src/generated/prisma").$Enums.UserStatus;
            artisanVerified: boolean;
            createdAt: string;
        };
    }>;
    verifyArtisan(userId: string, adminUser: {
        sub: string;
        role: UserRole;
    }): Promise<{
        message: string;
        data: {
            id: string;
            name: string;
            email: string;
            role: import("src/generated/prisma").$Enums.UserRole;
            status: import("src/generated/prisma").$Enums.UserStatus;
            artisanVerified: boolean;
            createdAt: string;
        };
    }>;
    resetUserPassword(userId: string, body: AdminResetPasswordDto, adminUser: {
        sub: string;
        role: UserRole;
    }): Promise<{
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
            contractId: string | null;
            jobId: string | null;
            clientId: string;
            artisanId: string;
            amount: number;
            status: import("src/generated/prisma").$Enums.DisputeStatus;
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
                decision: import("src/generated/prisma").$Enums.DisputeDecision;
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
    resolveDispute(disputeId: string, body: ResolveDisputeDto, adminUser: {
        sub: string;
        role: UserRole;
    }): Promise<{
        message: string;
        data: {
            id: string;
            contractId: string | null;
            jobId: string | null;
            clientId: string;
            artisanId: string;
            amount: number;
            status: import("src/generated/prisma").$Enums.DisputeStatus;
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
                decision: import("src/generated/prisma").$Enums.DisputeDecision;
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
            contractId: string | null;
            clientId: string;
            artisanId: string | null;
            amount: number | null;
            status: import("src/generated/prisma").$Enums.JobStatus;
            flagged: boolean;
            forceClosedAt: string | undefined;
            forceCloseReason: string | undefined;
        }[];
        meta: {
            total: number;
            flagged: number;
        };
    }>;
    forceCloseJob(jobId: string, body: ForceCloseJobDto, adminUser: {
        sub: string;
        role: UserRole;
    }): Promise<{
        message: string;
        data: {
            id: string;
            title: string;
            contractId: string | null;
            clientId: string;
            artisanId: string | null;
            amount: number | null;
            status: import("src/generated/prisma").$Enums.JobStatus;
            flagged: boolean;
            forceClosedAt: string | undefined;
            forceCloseReason: string | undefined;
        };
    }>;
    getAllTransactions(type?: string): Promise<{
        data: {
            id: string;
            userId: string;
            type: import("src/generated/prisma").$Enums.TransactionType;
            amount: number;
            status: import("src/generated/prisma").$Enums.TransactionStatus;
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
            entityType: import("src/generated/prisma").$Enums.AuditEntityType;
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
    private getActor;
}
