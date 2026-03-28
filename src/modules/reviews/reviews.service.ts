import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { randomUUID } from 'node:crypto';
import { ContractStatus } from '../../generated/prisma';

@Injectable()
export class ReviewsService {
  constructor(private readonly prisma: PrismaService) {}

  async createReview(
    userId: string,
    contractId: string,
    rating: number,
    comment: string,
    categories?: string[],
    workQuality?: number,
    communication?: number,
    timeliness?: number,
    professionalism?: number,
    evidence?: string[],
  ) {
    const contract = await this.prisma.contract.findUnique({
      where: { id: contractId },
    });

    if (!contract) {
      throw new NotFoundException('Contract not found');
    }

    // Check if user is the client
    if (contract.clientId !== userId) {
      throw new BadRequestException('Only clients can create reviews');
    }

    // Check if contract is completed
    if (contract.status !== ContractStatus.COMPLETED) {
      throw new BadRequestException('You can only review completed contracts');
    }

    // Check if review already exists for this contract
    const existingReview = await this.prisma.review.findFirst({
      where: {
        contractId,
        clientId: userId,
      },
    });

    if (existingReview) {
      throw new BadRequestException('You have already reviewed this contract');
    }

    // Create review with basic schema fields
    const review = await this.prisma.review.create({
      data: {
        id: randomUUID(),
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

  async updateReview(
    reviewId: string,
    userId: string,
    rating?: number,
    comment?: string,
    categories?: string[],
    workQuality?: number,
    communication?: number,
    timeliness?: number,
    professionalism?: number,
    evidence?: string[],
  ) {
    const review = await this.prisma.review.findUnique({
      where: { id: reviewId },
    });

    if (!review) {
      throw new NotFoundException('Review not found');
    }

    // Check if user is the review owner
    if (review.clientId !== userId) {
      throw new BadRequestException('You can only update your own reviews');
    }

    const updateData: any = {
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

  async getReviewsByUser(userId: string) {
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

  async getReviewById(reviewId: string, userId?: string) {
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
      throw new NotFoundException('Review not found');
    }

    // Check access
    // All reviews are public in the current schema, so no access check needed for visibility
    return review;
  }

  async getReviewStats(artisanId: string) {
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

    // Category averages are not available in the current schema
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
}
