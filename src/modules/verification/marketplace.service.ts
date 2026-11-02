import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { MarketplaceVerificationStatus } from '../../generated/prisma';
import { EventEmitter2 } from '@nestjs/event-emitter';

@Injectable()
export class MarketplaceVerificationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async submitProfile(userId: string) {
    const verification = await this.prisma.artisanVerification.upsert({
      where: { userId },
      create: {
        userId,
        marketplaceStatus: MarketplaceVerificationStatus.PENDING_REVIEW,
      },
      update: {
        marketplaceStatus: MarketplaceVerificationStatus.PENDING_REVIEW,
      },
    });

    this.eventEmitter.emit('marketplace.verification.submitted', { userId });
    return verification;
  }

  async getPending() {
    return this.prisma.artisanVerification.findMany({
      where: {
        marketplaceStatus: MarketplaceVerificationStatus.PENDING_REVIEW,
      },
      include: {
        user: true,
      },
    });
  }

  async getStatus(userId: string) {
    let verification = await this.prisma.artisanVerification.findUnique({
      where: { userId },
    });

    if (!verification) {
      verification = await this.prisma.artisanVerification.create({
        data: { userId },
      });
    }

    const isPayoutEligible =
      verification.marketplaceStatus === 'APPROVED' &&
      verification.financialStatus === 'VERIFIED';

    return {
      ...verification,
      isPayoutEligible,
    };
  }

  async approve(userId: string, adminId: string) {
    const verification = await this.prisma.artisanVerification.update({
      where: { userId },
      data: {
        marketplaceStatus: MarketplaceVerificationStatus.APPROVED,
        marketplaceApprovedAt: new Date(),
        marketplaceReviewerId: adminId,
      },
    });

    this.eventEmitter.emit('marketplace.verification.approved', { userId });
    this.checkEligibility(verification);

    return verification;
  }

  async reject(userId: string, reason: string, adminId: string) {
    const verification = await this.prisma.artisanVerification.update({
      where: { userId },
      data: {
        marketplaceStatus: MarketplaceVerificationStatus.REJECTED,
        marketplaceRejectedReason: reason,
        marketplaceReviewerId: adminId,
      },
    });

    this.eventEmitter.emit('marketplace.verification.rejected', { userId });

    return verification;
  }

  private checkEligibility(verification: any) {
    if (
      verification.marketplaceStatus === 'APPROVED' &&
      verification.financialStatus === 'VERIFIED'
    ) {
      this.eventEmitter.emit('payout.eligibility.granted', {
        userId: verification.userId,
      });
    }
  }
}
