import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { ReviewStatus, Prisma } from '../../generated/prisma';
import { reputationQueue } from '../../queue/queue';

@Injectable()
export class ReviewsService {
  private readonly logger = new Logger(ReviewsService.name);

  constructor(private readonly prisma: PrismaService) {}

  async getEligibleReviews(userId: string) {
    return this.prisma.reviewEligibility.findMany({
      where: { userId, status: 'PENDING' },
      include: {
        contract: { select: { id: true, amount: true, job: { select: { title: true } } } },
        target: { select: { id: true, name: true, image: true } }
      }
    });
  }

  async getReputationProfile(userId: string) {
    return this.prisma.reputationProfile.findUnique({
      where: { userId }
    });
  }

  async submitReview(userId: string, contractId: string, targetId: string, rating: number, comment?: string, breakdown?: any) {
    return this.prisma.$transaction(async (tx) => {
      // 1. Verify eligibility
      const eligibility = await tx.reviewEligibility.findFirst({
        where: { userId, contractId, targetId, status: 'PENDING' }
      });

      if (!eligibility) {
        throw new BadRequestException('You are not eligible to review this contract or have already reviewed it.');
      }

      if (eligibility.expiresAt < new Date()) {
        await tx.reviewEligibility.update({
          where: { id: eligibility.id },
          data: { status: 'EXPIRED' }
        });
        throw new BadRequestException('Review period has expired.');
      }

      // 2. Check if the other party has submitted their review
      const otherPartyEligibility = await tx.reviewEligibility.findFirst({
        where: { userId: targetId, contractId, targetId: userId }
      });

      const otherPartySubmitted = otherPartyEligibility?.status === 'CONSUMED';
      const initialStatus = otherPartySubmitted ? ReviewStatus.VISIBLE : ReviewStatus.SUBMITTED;

      // 3. Create the review
      const review = await tx.review.create({
        data: {
          contractId,
          authorId: userId,
          targetId,
          rating,
          comment,
          breakdown: breakdown ?? Prisma.JsonNull,
          status: initialStatus,
          visibleAt: initialStatus === ReviewStatus.VISIBLE ? new Date() : null,
        }
      });

      // 4. Update eligibility
      await tx.reviewEligibility.update({
        where: { id: eligibility.id },
        data: { status: 'CONSUMED' }
      });

      // 5. If both have submitted, make the other party's review visible and update both reputation profiles
      if (otherPartySubmitted) {
        await tx.review.updateMany({
          where: { contractId, authorId: targetId },
          data: { status: ReviewStatus.VISIBLE, visibleAt: new Date() }
        });

        // Trigger asynchronous reputation calculation
        await reputationQueue.add('calculateReputation', { userId });
        await reputationQueue.add('calculateReputation', { userId: targetId });
      }

      return review;
    });
  }
}
