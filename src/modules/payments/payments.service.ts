import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { WalletService } from '../wallet/wallet.service';
import { ContractsService } from '../contracts/contracts.service';
import { randomUUID } from 'node:crypto';

@Injectable()
export class PaymentsService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(forwardRef(() => WalletService))
    private readonly walletService: WalletService,
    @Inject(forwardRef(() => ContractsService))
    private readonly contractsService: ContractsService,
  ) {}

  private async ensureVerifiedArtisan(artisanId: string) {
    const artisan = await this.prisma.user.findUnique({
      where: { id: artisanId },
      select: {
        artisanVerified: true,
      },
    });

    if (!artisan?.artisanVerified) {
      throw new BadRequestException(
        'Artisan verification is required before releasing payment.',
      );
    }
  }

  private getPaystackSecretKey(): string {
    const key = process.env.PAYSTACK_SECRET_KEY;
    if (!key) {
      throw new Error(
        'PAYSTACK_SECRET_KEY is required in environment variables',
      );
    }
    return key;
  }

  private getPaystackHeaders() {
    return {
      Authorization: `Bearer ${this.getPaystackSecretKey()}`,
      'Content-Type': 'application/json',
    };
  }

  async initPaystackPayment(
    userId: string,
    amount: number,
    email: string,
    callbackUrl?: string,
  ) {
    if (amount <= 0) {
      throw new BadRequestException('Amount must be greater than 0');
    }

    const payload = {
      amount: Math.round(amount * 100),
      email,
      callback_url: callbackUrl || `${process.env.APP_URL}/wallet`,
      metadata: {
        userId,
        gateway: 'paystack',
      },
    };

    const response = await fetch(
      'https://api.paystack.co/transaction/initialize',
      {
        method: 'POST',
        headers: this.getPaystackHeaders(),
        body: JSON.stringify(payload),
      },
    );

    const data = await response.json();

    if (!response.ok || !data.status) {
      throw new BadRequestException(
        data.message || 'Failed to initialize Paystack payment',
      );
    }

    return {
      authorizationUrl: data.data.authorization_url,
      accessCode: data.data.access_code,
      reference: data.data.reference,
    };
  }

  async verifyPaystackPayment(userId: string, reference: string) {
    if (!reference) {
      throw new BadRequestException(
        'Reference is required for Paystack verification',
      );
    }

    const existingTransaction = await this.prisma.transaction.findFirst({
      where: { reference },
    });

    if (existingTransaction?.status === 'COMPLETED') {
      return {
        message: 'Payment already processed',
        reference,
        amount: existingTransaction.amount,
      };
    }

    const response = await fetch(
      `https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`,
      {
        method: 'GET',
        headers: this.getPaystackHeaders(),
      },
    );

    const data = await response.json();

    if (!response.ok || !data.status || data.data.status !== 'success') {
      throw new BadRequestException(
        data.message || 'Paystack transaction verification failed',
      );
    }

    const resolvedUserId =
      (data.data.metadata?.userId as string | undefined) ?? userId;
    const amount = Math.round(data.data.amount / 100);

    await this.walletService.addFunds(resolvedUserId, amount, reference, {
      gateway: 'paystack',
      paystackStatus: data.data.status,
      paystackResponse: data.data,
    });

    return {
      message: 'Paystack payment verified and wallet funded',
      reference,
      amount,
    };
  }

  async fundContract(
    userId: string,
    contractId: string,
    amount: number,
    paymentMethod?: string,
    paymentReference?: string,
  ) {
    const contract = await this.prisma.contract.findUnique({
      where: { id: contractId },
    });

    if (!contract) {
      throw new NotFoundException('Contract not found');
    }

    if (contract.status !== 'DRAFT') {
      throw new BadRequestException(
        'Contract must be in DRAFT status to be funded',
      );
    }

    if (contract.clientId !== userId) {
      throw new BadRequestException('Only the client can fund the contract');
    }

    // Use wallet service to handle the funding with proper transaction management
    const result = await this.walletService.freezeFunds(
      userId,
      amount,
      `contract_funding_${contractId}`,
      {
        action: 'contract_funding',
        contractId,
        paymentMethod,
        paymentReference,
      },
    );

    // Create payment record
    const payment = await this.prisma.payment.create({
      data: {
        id: randomUUID(),
        contractId,
        userId,
        amount,
        status: 'COMPLETED',
        paymentMethod: paymentMethod || null,
        paymentReference: paymentReference || null,
        verificationCode: Math.random()
          .toString(36)
          .substring(2, 8)
          .toUpperCase(),
        isVerified: true,
        createdAt: new Date(),
        verifiedAt: new Date(),
        completedAt: new Date(),
      },
    });

    // Update contract status using contracts service
    await this.contractsService.fundContract(contractId, userId, amount);

    return {
      payment,
      walletTransaction: result.transaction,
      message: 'Contract funded successfully',
    };
  }

  async verifyPayment(paymentId: string, verificationCode: string) {
    const payment = await this.prisma.payment.findUnique({
      where: { id: paymentId },
      include: {
        contract: true,
      },
    });

    if (!payment) {
      throw new NotFoundException('Payment not found');
    }

    if (payment.isVerified) {
      throw new BadRequestException('Payment is already verified');
    }

    if (payment.verificationCode !== verificationCode) {
      throw new BadRequestException('Invalid verification code');
    }

    // Update payment status
    const updatedPayment = await this.prisma.payment.update({
      where: { id: paymentId },
      data: {
        status: 'COMPLETED',
        isVerified: true,
        verifiedAt: new Date(),
        completedAt: new Date(),
      },
    });

    return updatedPayment;
  }

  async activateContract(contractId: string, userId: string) {
    return await this.contractsService.activateContract(contractId, userId);
  }

  async completeContract(
    contractId: string,
    userId: string,
    isClient: boolean,
    _notes?: string,
  ) {
    void _notes;

    return await this.contractsService.confirmCompletion(
      contractId,
      userId,
      isClient,
    );
  }

  async releaseEscrow(contractId: string, userId: string) {
    const contract = await this.prisma.contract.findUnique({
      where: { id: contractId },
    });

    if (!contract) {
      throw new NotFoundException('Contract not found');
    }

    if (contract.clientId !== userId) {
      throw new BadRequestException('Only the client can release escrow');
    }

    await this.ensureVerifiedArtisan(contract.artisanId);

    // Use contracts service to handle escrow release
    const result = await this.contractsService.releaseEscrow(
      contractId,
      userId,
    );

    // Settle escrow from client to artisan
    await this.walletService.releaseEscrowToUser(
      contract.clientId,
      contract.artisanId,
      contract.amount,
      `escrow_release_${contractId}`,
      {
        action: 'escrow_release',
        contractId,
      },
    );

    const platformFee = Math.floor(contract.amount * 0.05);
    if (platformFee > 0) {
      await this.walletService.chargePlatformFee(
        contract.clientId,
        platformFee,
        `platform_fee_${contractId}`,
        {
          action: 'platform_fee',
          contractId,
        },
      );
    }

    return result;
  }

  async refundContract(contractId: string, userId: string, reason?: string) {
    const contract = await this.prisma.contract.findUnique({
      where: { id: contractId },
    });

    if (!contract) {
      throw new NotFoundException('Contract not found');
    }

    if (contract.clientId !== userId) {
      throw new BadRequestException('Only the client can request a refund');
    }

    // Use contracts service to handle refund
    const result = await this.contractsService.refundContract(
      contractId,
      userId,
    );

    // Release frozen funds back to client
    await this.walletService.unfreezeFunds(
      contract.clientId,
      contract.amount,
      `contract_refund_${contractId}`,
      {
        action: 'contract_refund',
        contractId,
        reason,
      },
    );

    return result;
  }

  getDefinition() {
    return {
      name: 'payments',
      description: 'Handles payment processing and escrow management',
      responsibilities: [
        'Process contract funding payments',
        'Verify payment confirmations',
        'Manage contract activation',
        'Handle contract completion workflows',
        'Process escrow releases',
        'Deduct platform fees',
        'Maintain payment records',
      ],
      rules: [
        'All payment operations must use transactions',
        'Funds can only be released with dual confirmation',
        'Platform fees are automatically deducted',
        'Payment verification codes are single-use',
        'Contract status transitions are enforced',
      ],
    };
  }
}
