import { PrismaService } from '../../database/prisma.service';
import { DisputeStatus, DisputeDecision } from '../../generated/prisma';
export declare class DisputesService {
    private readonly prisma;
    constructor(prisma: PrismaService);
    createDispute(userId: string, amount: number, description: string, contractId?: string, jobId?: string, evidenceImages?: string[], evidenceVideos?: string[], evidenceMessages?: string[]): Promise<{
        amount: number;
        updatedAt: Date;
        resolutionDecision: import("../../generated/prisma").$Enums.DisputeDecision | null;
        resolvedBy: string | null;
        resolutionNotes: string | null;
        id: string;
        status: import("../../generated/prisma").$Enums.DisputeStatus;
        createdAt: Date;
        jobId: string | null;
        artisanId: string;
        clientId: string;
        contractId: string | null;
        evidenceImages: import("src/generated/prisma/runtime/client").JsonValue;
        evidenceVideos: import("src/generated/prisma/runtime/client").JsonValue;
        evidenceMessages: import("src/generated/prisma/runtime/client").JsonValue;
        resolvedAt: Date | null;
    }>;
    updateDispute(disputeId: string, status?: DisputeStatus, resolutionDecision?: DisputeDecision, resolutionNotes?: string, resolvedBy?: string): Promise<{
        amount: number;
        updatedAt: Date;
        resolutionDecision: import("../../generated/prisma").$Enums.DisputeDecision | null;
        resolvedBy: string | null;
        resolutionNotes: string | null;
        id: string;
        status: import("../../generated/prisma").$Enums.DisputeStatus;
        createdAt: Date;
        jobId: string | null;
        artisanId: string;
        clientId: string;
        contractId: string | null;
        evidenceImages: import("src/generated/prisma/runtime/client").JsonValue;
        evidenceVideos: import("src/generated/prisma/runtime/client").JsonValue;
        evidenceMessages: import("src/generated/prisma/runtime/client").JsonValue;
        resolvedAt: Date | null;
    }>;
    getDisputesByUser(userId: string): Promise<({
        user: {
            name: string;
            id: string;
            email: string;
        };
    } & {
        amount: number;
        updatedAt: Date;
        resolutionDecision: import("../../generated/prisma").$Enums.DisputeDecision | null;
        resolvedBy: string | null;
        resolutionNotes: string | null;
        id: string;
        status: import("../../generated/prisma").$Enums.DisputeStatus;
        createdAt: Date;
        jobId: string | null;
        artisanId: string;
        clientId: string;
        contractId: string | null;
        evidenceImages: import("src/generated/prisma/runtime/client").JsonValue;
        evidenceVideos: import("src/generated/prisma/runtime/client").JsonValue;
        evidenceMessages: import("src/generated/prisma/runtime/client").JsonValue;
        resolvedAt: Date | null;
    })[]>;
    getDisputeById(disputeId: string, userId?: string): Promise<{
        user: {
            name: string;
            id: string;
            email: string;
        };
    } & {
        amount: number;
        updatedAt: Date;
        resolutionDecision: import("../../generated/prisma").$Enums.DisputeDecision | null;
        resolvedBy: string | null;
        resolutionNotes: string | null;
        id: string;
        status: import("../../generated/prisma").$Enums.DisputeStatus;
        createdAt: Date;
        jobId: string | null;
        artisanId: string;
        clientId: string;
        contractId: string | null;
        evidenceImages: import("src/generated/prisma/runtime/client").JsonValue;
        evidenceVideos: import("src/generated/prisma/runtime/client").JsonValue;
        evidenceMessages: import("src/generated/prisma/runtime/client").JsonValue;
        resolvedAt: Date | null;
    }>;
    private validateStatusTransition;
    getDefinition(): {
        name: string;
        description: string;
        responsibilities: string[];
        rules: string[];
    };
}
