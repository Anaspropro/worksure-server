import { PrismaService } from '../../database/prisma.service';
export declare class ReviewsService {
    private readonly prisma;
    constructor(prisma: PrismaService);
    createReview(userId: string, contractId: string, rating: number, comment: string, categories?: string[], workQuality?: number, communication?: number, timeliness?: number, professionalism?: number, evidence?: string[]): Promise<{
        id: string;
        createdAt: Date;
        artisanId: string;
        clientId: string;
        contractId: string;
        rating: number;
        comment: string | null;
    }>;
    updateReview(reviewId: string, userId: string, rating?: number, comment?: string, categories?: string[], workQuality?: number, communication?: number, timeliness?: number, professionalism?: number, evidence?: string[]): Promise<{
        id: string;
        createdAt: Date;
        artisanId: string;
        clientId: string;
        contractId: string;
        rating: number;
        comment: string | null;
    }>;
    getReviewsByUser(userId: string): Promise<({
        client: {
            name: string;
            id: string;
            email: string;
        };
        contract: {
            job: {
                title: string;
            };
        } & {
            amount: number;
            updatedAt: Date;
            clientConfirmedCompletion: boolean;
            artisanConfirmedCompletion: boolean;
            escrowReleased: boolean;
            platformFeeDeducted: boolean;
            id: string;
            status: import("../../generated/prisma").$Enums.ContractStatus;
            createdAt: Date;
            jobId: string;
            artisanId: string;
            clientId: string;
            proposalId: string;
            fundedAt: Date | null;
            activatedAt: Date | null;
            startedAt: Date | null;
            completedAt: Date | null;
            cancelledAt: Date | null;
            clientConfirmedAt: Date | null;
            artisanConfirmedAt: Date | null;
            escrowReleasedAt: Date | null;
        };
        artisan: {
            name: string;
            id: string;
            email: string;
        };
    } & {
        id: string;
        createdAt: Date;
        artisanId: string;
        clientId: string;
        contractId: string;
        rating: number;
        comment: string | null;
    })[]>;
    getReviewById(reviewId: string, userId?: string): Promise<{
        client: {
            name: string;
            id: string;
            email: string;
        };
        contract: {
            job: {
                title: string;
            };
        } & {
            amount: number;
            updatedAt: Date;
            clientConfirmedCompletion: boolean;
            artisanConfirmedCompletion: boolean;
            escrowReleased: boolean;
            platformFeeDeducted: boolean;
            id: string;
            status: import("../../generated/prisma").$Enums.ContractStatus;
            createdAt: Date;
            jobId: string;
            artisanId: string;
            clientId: string;
            proposalId: string;
            fundedAt: Date | null;
            activatedAt: Date | null;
            startedAt: Date | null;
            completedAt: Date | null;
            cancelledAt: Date | null;
            clientConfirmedAt: Date | null;
            artisanConfirmedAt: Date | null;
            escrowReleasedAt: Date | null;
        };
        artisan: {
            name: string;
            id: string;
            email: string;
        };
    } & {
        id: string;
        createdAt: Date;
        artisanId: string;
        clientId: string;
        contractId: string;
        rating: number;
        comment: string | null;
    }>;
    getReviewStats(artisanId: string): Promise<{
        totalReviews: number;
        averageRating: number;
        ratingDistribution: {
            1: number;
            2: number;
            3: number;
            4: number;
            5: number;
        };
        categoryAverages: {
            workQuality: number;
            communication: number;
            timeliness: number;
            professionalism: number;
        };
    }>;
    getDefinition(): {
        name: string;
        description: string;
        responsibilities: string[];
        rules: string[];
    };
}
