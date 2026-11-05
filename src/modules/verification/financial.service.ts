import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import {
  FinancialVerificationStatus,
  MarketplaceVerificationStatus,
} from '../../generated/prisma';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PaystackVerificationProvider } from './providers/paystack.provider';
import { PaystackClientService } from '../../common/services/paystack-client.service';

@Injectable()
export class FinancialVerificationService {
  private readonly logger = new Logger(FinancialVerificationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly eventEmitter: EventEmitter2,
    private readonly identityProvider: PaystackVerificationProvider,
    private readonly paystackClient: PaystackClientService,
  ) {}

  async getBanks(): Promise<Array<{ name: string; code: string; slug: string }>> {
    try {
      const response = await this.paystackClient.get<
        Array<{ name: string; code: string; slug: string; active?: boolean }>
      >('/bank?country=nigeria', { graceful: true });

      if (response && Array.isArray(response) && response.length > 0) {
        return response
          .filter((b) => b.active !== false)
          .map((b) => ({ name: b.name, code: b.code, slug: b.slug }));
      }
    } catch (error) {
      this.logger.warn('Failed to fetch banks from Paystack, falling back to static list');
    }

    return [
      { name: 'Access Bank', code: '044', slug: 'access-bank' },
      { name: 'Access Bank (Diamond)', code: '063', slug: 'access-bank-diamond' },
      { name: 'First Bank of Nigeria', code: '011', slug: 'first-bank-of-nigeria' },
      { name: 'Guaranty Trust Bank (GTBank)', code: '058', slug: 'guaranty-trust-bank' },
      { name: 'Zenith Bank', code: '057', slug: 'zenith-bank' },
      { name: 'United Bank for Africa (UBA)', code: '033', slug: 'united-bank-for-africa' },
      { name: 'Fidelity Bank', code: '070', slug: 'fidelity-bank' },
      { name: 'Stanbic IBTC Bank', code: '221', slug: 'stanbic-ibtc-bank' },
      { name: 'Sterling Bank', code: '232', slug: 'sterling-bank' },
      { name: 'Union Bank of Nigeria', code: '032', slug: 'union-bank-of-nigeria' },
      { name: 'Wema Bank', code: '035', slug: 'wema-bank' },
      { name: 'Kuda Bank', code: '50211', slug: 'kuda-bank' },
      { name: 'OPay Digital Services', code: '999992', slug: 'opay' },
      { name: 'PalmPay', code: '999991', slug: 'palmpay' },
      { name: 'Moniepoint Microfinance Bank', code: '50515', slug: 'moniepoint-mfb-ng' },
    ];
  }

  verifyNameMatch(registeredName: string, resolvedName: string): boolean {
    if (!registeredName || !resolvedName) return false;

    const normalize = (str: string) =>
      str
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, '')
        .split(/\s+/)
        .filter((tok) => tok.length >= 2);

    const regTokens = normalize(registeredName);
    const resolvedTokens = normalize(resolvedName);

    if (regTokens.length === 0 || resolvedTokens.length === 0) return false;

    const matchCount = regTokens.filter((token) =>
      resolvedTokens.includes(token),
    ).length;

    return matchCount > 0 && matchCount >= Math.ceil(regTokens.length / 2);
  }

  async resolveBankAccount(
    userId: string,
    accountNumber: string,
    bankCode: string,
  ) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const cleanAccount = accountNumber ? accountNumber.trim() : '';
    const cleanBank = bankCode ? bankCode.trim() : '';

    if (!cleanAccount || !/^\d{10}$/.test(cleanAccount)) {
      throw new BadRequestException('Account number must be a 10-digit number');
    }

    if (!cleanBank) {
      throw new BadRequestException('Bank code is required');
    }

    let resolvedData: {
      account_number: string;
      account_name: string;
      bank_id?: number;
    } | null = null;

    try {
      resolvedData = await this.paystackClient.call<{
        account_number: string;
        account_name: string;
        bank_id?: number;
      }>(
        `/bank/resolve?account_number=${encodeURIComponent(cleanAccount)}&bank_code=${encodeURIComponent(cleanBank)}`,
        { method: 'GET' },
      );
    } catch (err: any) {
      this.logger.error(`Paystack bank resolution failed: ${err.message}`);
      throw new BadRequestException(
        err.message ||
          'Failed to resolve bank account with Paystack. Please check the account number and bank code.',
      );
    }

    if (!resolvedData || !resolvedData.account_name) {
      throw new BadRequestException(
        'Unable to resolve bank account name from Paystack',
      );
    }

    const resolvedName = resolvedData.account_name.trim();

    const isMatch = this.verifyNameMatch(user.name, resolvedName);
    if (!isMatch) {
      throw new BadRequestException(
        `Resolved account name "${resolvedName}" does not match your registered profile name "${user.name}". Please ensure your bank account name matches your profile.`,
      );
    }

    const providerRef = `bank_resolve_${cleanAccount}_${cleanBank}`;

    const [, updatedVerification] = await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: userId },
        data: {
          payoutAccountNumber: cleanAccount,
          payoutBankCode: cleanBank,
          payoutAccountName: resolvedName,
        },
      }),
      this.prisma.artisanVerification.upsert({
        where: { userId },
        create: {
          userId,
          financialStatus: FinancialVerificationStatus.VERIFIED,
          financialVerifiedAt: new Date(),
          financialProviderRef: providerRef,
          financialFailureReason: null,
        },
        update: {
          financialStatus: FinancialVerificationStatus.VERIFIED,
          financialVerifiedAt: new Date(),
          financialProviderRef: providerRef,
          financialFailureReason: null,
        },
      }),
    ]);

    this.eventEmitter.emit('financial.verification.succeeded', { userId });
    this.checkEligibility(updatedVerification);

    return {
      verified: true,
      accountNumber: cleanAccount,
      bankCode: cleanBank,
      accountName: resolvedName,
      financialStatus: updatedVerification.financialStatus,
      isPayoutEligible:
        updatedVerification.marketplaceStatus ===
        MarketplaceVerificationStatus.APPROVED,
    };
  }

  async initiate(
    userId: string,
    email: string,
    details?: { accountNumber?: string; bankCode?: string },
  ) {
    if (details?.accountNumber && details?.bankCode) {
      return this.resolveBankAccount(
        userId,
        details.accountNumber,
        details.bankCode,
      );
    }

    let verification = await this.prisma.artisanVerification.findUnique({
      where: { userId },
    });

    if (!verification) {
      verification = await this.prisma.artisanVerification.create({
        data: { userId },
      });
    }

    if (verification.financialStatus === 'VERIFIED') {
      return {
        url: null,
        reference: verification.financialProviderRef,
        status: verification.financialStatus,
      };
    }

    const session = await this.identityProvider.initiateVerification(
      userId,
      email,
    );

    await this.prisma.artisanVerification.update({
      where: { userId },
      data: {
        financialProviderRef: session.reference,
        financialStatus: FinancialVerificationStatus.PENDING,
      },
    });

    this.eventEmitter.emit('financial.verification.started', { userId });
    return session;
  }

  async handleWebhook(payload: any, signature: string, secret: string) {
    if (
      !this.identityProvider.verifyWebhookSignature(payload, signature, secret)
    ) {
      throw new Error('Invalid webhook signature');
    }

    const result = this.identityProvider.parseWebhook(payload);

    const verification = await this.prisma.artisanVerification.findFirst({
      where: { financialProviderRef: result.reference },
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
        financialStatus: result.status,
        financialVerifiedAt: result.verifiedAt,
        financialFailureReason: result.failureReason,
      },
    });

    if (result.status === 'VERIFIED') {
      this.eventEmitter.emit('financial.verification.succeeded', {
        userId: updated.userId,
      });
    } else if (result.status === 'FAILED') {
      this.eventEmitter.emit('financial.verification.failed', {
        userId: updated.userId,
      });
    }

    this.checkEligibility(updated);

    return updated;
  }

  private checkEligibility(verification: any) {
    if (
      verification.marketplaceStatus === 'APPROVED' &&
      verification.financialStatus === 'VERIFIED'
    ) {
      this.eventEmitter.emit('payout.eligibility.granted', {
        userId: verification.userId,
      });
    } else {
      this.eventEmitter.emit('payout.eligibility.revoked', {
        userId: verification.userId,
      });
    }
  }
}
