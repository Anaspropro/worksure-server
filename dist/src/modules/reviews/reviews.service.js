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
exports.ReviewsService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../database/prisma.service");
const node_crypto_1 = require("node:crypto");
const prisma_1 = require("../../generated/prisma");
let ReviewsService = class ReviewsService {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    async createReview(userId, contractId, rating, comment, categories, workQuality, communication, timeliness, professionalism, evidence) {
        const contract = await this.prisma.contract.findUnique({
            where: { id: contractId },
        });
        if (!contract) {
            throw new common_1.NotFoundException('Contract not found');
        }
        if (contract.clientId !== userId) {
            throw new common_1.BadRequestException('Only clients can create reviews');
        }
        if (contract.status !== prisma_1.ContractStatus.COMPLETED) {
            throw new common_1.BadRequestException('You can only review completed contracts');
        }
        const existingReview = await this.prisma.review.findFirst({
            where: {
                contractId,
                clientId: userId,
            },
        });
        if (existingReview) {
            throw new common_1.BadRequestException('You have already reviewed this contract');
        }
        const review = await this.prisma.review.create({
            data: {
                id: (0, node_crypto_1.randomUUID)(),
                contractId,
                clientId: userId,
                artisanId: contract.artisanId,
                rating,
                comment,
                createdAt: new Date(),
            },
        });
        return review;
    }
    async updateReview(reviewId, userId, rating, comment, categories, workQuality, communication, timeliness, professionalism, evidence) {
        const review = await this.prisma.review.findUnique({
            where: { id: reviewId },
        });
        if (!review) {
            throw new common_1.NotFoundException('Review not found');
        }
        if (review.clientId !== userId) {
            throw new common_1.BadRequestException('You can only update your own reviews');
        }
        const updateData = {
            ...(rating !== undefined && { rating }),
            ...(comment && { comment }),
            updatedAt: new Date(),
        };
        const updatedReview = await this.prisma.review.update({
            where: { id: reviewId },
            data: updateData,
        });
        return updatedReview;
    }
    async getReviewsByUser(userId) {
        return await this.prisma.review.findMany({
            where: {
                clientId: userId,
            },
            include: {
                contract: {
                    include: {
                        job: {
                            select: {
                                title: true,
                            },
                        },
                    },
                },
                client: {
                    select: {
                        id: true,
                        name: true,
                        email: true,
                    },
                },
                artisan: {
                    select: {
                        id: true,
                        name: true,
                        email: true,
                    },
                },
            },
            orderBy: { createdAt: 'desc' },
        });
    }
    async getReviewById(reviewId, userId) {
        const review = await this.prisma.review.findUnique({
            where: { id: reviewId },
            include: {
                contract: {
                    include: {
                        job: {
                            select: {
                                title: true,
                            },
                        },
                    },
                },
                client: {
                    select: {
                        id: true,
                        name: true,
                        email: true,
                    },
                },
                artisan: {
                    select: {
                        id: true,
                        name: true,
                        email: true,
                    },
                },
            },
        });
        if (!review) {
            throw new common_1.NotFoundException('Review not found');
        }
        return review;
    }
    async getReviewStats(artisanId) {
        const reviews = await this.prisma.review.findMany({
            where: {
                artisanId,
            },
        });
        const totalReviews = reviews.length;
        const averageRating = totalReviews > 0
            ? reviews.reduce((sum, review) => sum + review.rating, 0) / totalReviews
            : 0;
        const ratingDistribution = {
            1: reviews.filter(r => r.rating === 1).length,
            2: reviews.filter(r => r.rating === 2).length,
            3: reviews.filter(r => r.rating === 3).length,
            4: reviews.filter(r => r.rating === 4).length,
            5: reviews.filter(r => r.rating === 5).length,
        };
        const categoryAverages = {
            workQuality: 0,
            communication: 0,
            timeliness: 0,
            professionalism: 0,
        };
        return {
            totalReviews,
            averageRating,
            ratingDistribution,
            categoryAverages,
        };
    }
    getDefinition() {
        return {
            name: 'reviews',
            description: 'Handles user reviews and ratings for completed contracts',
            responsibilities: [
                'Create and manage user reviews',
                'Validate review eligibility',
                'Calculate review statistics',
                'Handle review categories and ratings',
                'Manage review visibility and access',
                'Provide review history and analytics',
            ],
            rules: [
                'Only clients can create reviews',
                'Reviews can only be created for completed contracts',
                'One review per contract per client',
                'Reviews are public by default',
                'Review ratings must be between 1-5',
                'Category ratings are optional but validated',
            ],
        };
    }
};
exports.ReviewsService = ReviewsService;
exports.ReviewsService = ReviewsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], ReviewsService);
//# sourceMappingURL=reviews.service.js.map