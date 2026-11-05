import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import {
  MarketplaceVerificationStatus,
  FinancialVerificationStatus,
  KycDocumentStatus,
} from '../../generated/prisma';
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
        user: {
          include: {
            artisanProfile: true,
            kycDocuments: true,
          },
        },
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

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        kycDocuments: true,
      },
    });

    const isPayoutEligible =
      verification.marketplaceStatus === MarketplaceVerificationStatus.APPROVED &&
      verification.financialStatus === FinancialVerificationStatus.VERIFIED;

    return {
      ...verification,
      isPayoutEligible,
      payoutBankCode: user?.payoutBankCode,
      payoutAccountNumber: user?.payoutAccountNumber,
      payoutAccountName: user?.payoutAccountName,
      artisanVerified: user?.artisanVerified ?? false,
      documents: user?.kycDocuments ?? [],
    };
  }

  async approve(userId: string, adminId: string) {
    const [verification] = await this.prisma.$transaction([
      this.prisma.artisanVerification.update({
        where: { userId },
        data: {
          marketplaceStatus: MarketplaceVerificationStatus.APPROVED,
          marketplaceApprovedAt: new Date(),
          marketplaceReviewerId: adminId,
        },
      }),
      this.prisma.user.update({
        where: { id: userId },
        data: { artisanVerified: true },
      }),
      this.prisma.artisanProfile.updateMany({
        where: { userId },
        data: { verified: true },
      }),
      this.prisma.kycDocument.updateMany({
        where: { userId, status: KycDocumentStatus.PENDING },
        data: {
          status: KycDocumentStatus.VERIFIED,
          reviewedBy: adminId,
          reviewedAt: new Date(),
        },
      }),
    ]);

    this.eventEmitter.emit('marketplace.verification.approved', { userId });
    this.checkEligibility(verification);

    return verification;
  }

  async reject(userId: string, reason: string, adminId: string) {
    const [verification] = await this.prisma.$transaction([
      this.prisma.artisanVerification.update({
        where: { userId },
        data: {
          marketplaceStatus: MarketplaceVerificationStatus.REJECTED,
          marketplaceRejectedReason: reason,
          marketplaceReviewerId: adminId,
        },
      }),
      this.prisma.user.update({
        where: { id: userId },
        data: { artisanVerified: false },
      }),
      this.prisma.artisanProfile.updateMany({
        where: { userId },
        data: { verified: false },
      }),
      this.prisma.kycDocument.updateMany({
        where: { userId, status: KycDocumentStatus.PENDING },
        data: {
          status: KycDocumentStatus.REJECTED,
          rejectionReason: reason,
          reviewedBy: adminId,
          reviewedAt: new Date(),
        },
      }),
    ]);

    this.eventEmitter.emit('marketplace.verification.rejected', { userId });

    return verification;
  }

  async approveDocument(documentId: string, adminId: string) {
    const document = await this.prisma.kycDocument.findUnique({
      where: { id: documentId },
    });
    if (!document) {
      throw new NotFoundException(`KYC Document ${documentId} not found`);
    }

    return this.prisma.kycDocument.update({
      where: { id: documentId },
      data: {
        status: KycDocumentStatus.VERIFIED,
        reviewedBy: adminId,
        reviewedAt: new Date(),
      },
    });
  }

  async rejectDocument(documentId: string, reason: string, adminId: string) {
    const document = await this.prisma.kycDocument.findUnique({
      where: { id: documentId },
    });
    if (!document) {
      throw new NotFoundException(`KYC Document ${documentId} not found`);
    }

    return this.prisma.kycDocument.update({
      where: { id: documentId },
      data: {
        status: KycDocumentStatus.REJECTED,
        rejectionReason: reason,
        reviewedBy: adminId,
        reviewedAt: new Date(),
      },
    });
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
