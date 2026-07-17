import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { FinancialVerificationStatus } from '../../generated/prisma';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PaystackVerificationProvider } from './providers/paystack.provider';

@Injectable()
export class FinancialVerificationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly eventEmitter: EventEmitter2,
    private readonly identityProvider: PaystackVerificationProvider // Could inject based on interface in the future
  ) {}

  async initiate(userId: string, email: string) {
    let verification = await this.prisma.artisanVerification.findUnique({
      where: { userId }
    });

    if (!verification) {
      verification = await this.prisma.artisanVerification.create({
        data: { userId }
      });
    }

    if (verification.financialStatus === 'VERIFIED') {
      return { url: null, reference: verification.financialProviderRef };
    }

    const session = await this.identityProvider.initiateVerification(userId, email);

    await this.prisma.artisanVerification.update({
      where: { userId },
      data: {
        financialProviderRef: session.reference,
        financialStatus: FinancialVerificationStatus.PENDING
      }
    });

    this.eventEmitter.emit('financial.verification.started', { userId });
    return session;
  }

  async handleWebhook(payload: any, signature: string, secret: string) {
    if (!this.identityProvider.verifyWebhookSignature(payload, signature, secret)) {
      throw new Error('Invalid webhook signature');
    }

    const result = this.identityProvider.parseWebhook(payload);
    
    const verification = await this.prisma.artisanVerification.findFirst({
      where: { financialProviderRef: result.reference }
    });

    if (!verification) {
      throw new NotFoundException('Verification reference not found');
    }

    // Idempotency check
    if (verification.financialStatus === result.status) {
      return verification;
    }

    const updated = await this.prisma.artisanVerification.update({
      where: { id: verification.id },
      data: {
        financialStatus: result.status as FinancialVerificationStatus,
        financialVerifiedAt: result.verifiedAt,
        financialFailureReason: result.failureReason
      }
    });

    if (result.status === 'VERIFIED') {
      this.eventEmitter.emit('financial.verification.succeeded', { userId: updated.userId });
    } else if (result.status === 'FAILED') {
      this.eventEmitter.emit('financial.verification.failed', { userId: updated.userId });
    }

    this.checkEligibility(updated);
    
    return updated;
  }

  private checkEligibility(verification: any) {
    if (verification.marketplaceStatus === 'APPROVED' && verification.financialStatus === 'VERIFIED') {
      this.eventEmitter.emit('payout.eligibility.granted', { userId: verification.userId });
    } else {
      this.eventEmitter.emit('payout.eligibility.revoked', { userId: verification.userId });
    }
  }
}
