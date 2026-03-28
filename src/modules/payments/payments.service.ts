import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { randomUUID } from 'node:crypto';
import { TransactionType } from '../../generated/prisma';

@Injectable()
export class PaymentsService {
  constructor(private readonly prisma: PrismaService) {}

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
      throw new BadRequestException('Contract must be in DRAFT status to be funded');
    }

    // Create payment record
    const payment = await this.prisma.payment.create({
      data: {
        id: randomUUID(),
        contractId,
        userId,
        amount,
        status: 'pending',
        paymentMethod: paymentMethod || null,
        paymentReference: paymentReference || null,
        verificationCode: Math.random().toString(36).substring(2, 8).toUpperCase(),
        isVerified: false,
        createdAt: new Date(),
      },
    });

    return payment;
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

    // Verify payment and update contract
    const updatedPayment = await this.prisma.$transaction(async (tx) => {
      // Update payment
      const updated = await tx.payment.update({
        where: { id: paymentId },
        data: {
          status: 'completed',
          isVerified: true,
          verifiedAt: new Date(),
        },
      });

      // Update contract status to ACTIVE
      await tx.contract.update({
        where: { id: payment.contractId },
        data: {
          status: 'ACTIVE',
          fundedAt: new Date(),
        },
      });

      return updated;
    });

    return updatedPayment;
  }

  async activateContract(contractId: string) {
    const contract = await this.prisma.contract.findUnique({
      where: { id: contractId },
    });

    if (!contract) {
      throw new NotFoundException('Contract not found');
    }

    if (contract.status !== 'ACTIVE') {
      throw new BadRequestException('Contract must be ACTIVE to be activated');
    }

    if (contract.startedAt) {
      throw new BadRequestException('Contract is already started');
    }

    // Activate contract
    const updatedContract = await this.prisma.contract.update({
      where: { id: contractId },
      data: {
        status: 'ACTIVE',
        startedAt: new Date(),
      },
    });

    return updatedContract;
  }

  async completeContract(
    contractId: string,
    userId: string,
    isClient: boolean,
    notes?: string,
  ) {
    const contract = await this.prisma.contract.findUnique({
      where: { id: contractId },
    });

    if (!contract) {
      throw new NotFoundException('Contract not found');
    }

    if (contract.status !== 'ACTIVE') {
      throw new BadRequestException('Contract must be ACTIVE to be completed');
    }

    // Update completion status
    const updateData: any = {
      [isClient ? 'clientConfirmedCompletion' : 'artisanConfirmedCompletion']: true,
      [isClient ? 'clientConfirmedAt' : 'artisanConfirmedAt']: new Date(),
    };

    const updatedContract = await this.prisma.contract.update({
      where: { id: contractId },
      data: updateData,
    });

    // Check if both parties have confirmed
    if (updatedContract.clientConfirmedCompletion && updatedContract.artisanConfirmedCompletion) {
      await this.finalizeContractCompletion(contractId);
    }

    return updatedContract;
  }

  private async finalizeContractCompletion(contractId: string) {
    await this.prisma.$transaction(async (tx) => {
      // Update contract status to COMPLETED
      await tx.contract.update({
        where: { id: contractId },
        data: {
          status: 'COMPLETED',
          completedAt: new Date(),
        },
      });

      // Get contract details for payment processing
      const contract = await tx.contract.findUnique({
        where: { id: contractId },
      });

      if (contract) {
        // Create escrow release transaction for artisan
        await tx.transaction.create({
          data: {
            id: randomUUID(),
            userId: contract.artisanId,
            type: TransactionType.ESCROW_RELEASE,
            amount: contract.amount,
            status: 'COMPLETED',
            reference: contractId,
            metadata: { action: 'contract_completion', contractId },
            createdAt: new Date(),
            completedAt: new Date(),
          },
        });

        // Deduct platform fee from client's wallet
        const platformFee = Math.floor(contract.amount * 0.05); // 5% platform fee
        await tx.transaction.create({
          data: {
            id: randomUUID(),
            userId: contract.clientId,
            type: TransactionType.PLATFORM_FEE,
            amount: platformFee,
            status: 'COMPLETED',
            reference: contractId,
            metadata: { action: 'platform_fee', contractId },
            createdAt: new Date(),
            completedAt: new Date(),
          },
        });
      }
    });
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
