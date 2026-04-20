import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../../database/prisma.service';
import { ContractStatus } from '../../generated/prisma';

@Injectable()
export class ContractsService {
  constructor(private readonly prisma: PrismaService) {}

  private readonly contractInclude = {
    job: true,
    proposal: true,
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
        artisanVerified: true,
        paystackRecipientCode: true,
        payoutBankCode: true,
        payoutAccountNumber: true,
        payoutAccountName: true,
      },
    },
    payments: true,
    review: true,
  } as const;

  private async getContractOrThrow(contractId: string) {
    const contract = await this.prisma.contract.findUnique({
      where: { id: contractId },
      include: this.contractInclude,
    });

    if (!contract) {
      throw new NotFoundException('Contract not found');
    }

    return contract;
  }

  async createContract(proposalId: string, userId: string) {
    const proposal = await this.prisma.proposal.findUnique({
      where: { id: proposalId },
      include: {
        job: true,
        client: true,
        artisan: true,
      },
    });

    if (!proposal) {
      throw new NotFoundException('Proposal not found');
    }

    if (proposal.status !== 'ACCEPTED') {
      throw new BadRequestException(
        'Proposal must be accepted to create contract',
      );
    }

    if (proposal.clientId !== userId) {
      throw new ForbiddenException('Only the client can create a contract');
    }

    if (!proposal.artisan.artisanVerified) {
      throw new BadRequestException(
        'Cannot create a contract for an unverified artisan.',
      );
    }

    const existingContract = await this.prisma.contract.findUnique({
      where: { proposalId },
    });

    if (existingContract) {
      throw new BadRequestException(
        'Contract already exists for this proposal',
      );
    }

    const contract = await this.prisma.$transaction(async (tx) => {
      const newContract = await tx.contract.create({
        data: {
          id: randomUUID(),
          jobId: proposal.jobId,
          proposalId,
          clientId: proposal.clientId,
          artisanId: proposal.artisanId,
          amount: proposal.amount,
          status: ContractStatus.PENDING_PAYMENT,
          currency: 'NGN',
        },
        include: this.contractInclude,
      });

      await tx.job.update({
        where: { id: proposal.jobId },
        data: { contractId: newContract.id },
      });

      return newContract;
    });

    return contract;
  }

  async activateContract(contractId: string, userId: string) {
    const contract = await this.getContractOrThrow(contractId);

    if (contract.clientId !== userId && contract.artisanId !== userId) {
      throw new ForbiddenException(
        'Only contract parties can activate the contract',
      );
    }

    if (contract.status !== ContractStatus.FUNDED) {
      throw new BadRequestException(
        'Contract must be FUNDED before work can begin',
      );
    }

    return this.prisma.contract.update({
      where: { id: contractId },
      data: {
        status: ContractStatus.IN_PROGRESS,
        activatedAt: contract.activatedAt ?? new Date(),
        startedAt: contract.startedAt ?? new Date(),
      },
      include: this.contractInclude,
    });
  }

  async markFunded(
    contractId: string,
    paymentId: string,
    paystackReference: string,
    authorizationUrl?: string | null,
    accessCode?: string | null,
  ) {
    await this.getContractOrThrow(contractId);

    return this.prisma.contract.update({
      where: { id: contractId },
      data: {
        status: ContractStatus.FUNDED,
        fundedAt: new Date(),
        paystackReference: paystackReference || null,
        paystackAuthorizationUrl: authorizationUrl || null,
        paystackAccessCode: accessCode || null,
        fundedPaymentId: paymentId,
      },
      include: this.contractInclude,
    });
  }

  async confirmCompletion(
    contractId: string,
    userId: string,
    isClient: boolean,
  ) {
    const contract = await this.getContractOrThrow(contractId);

    if (isClient && contract.clientId !== userId) {
      throw new ForbiddenException('Only the client can confirm completion');
    }

    if (!isClient && contract.artisanId !== userId) {
      throw new ForbiddenException('Only the artisan can confirm completion');
    }

    const completableStatuses = new Set<ContractStatus>([
      ContractStatus.IN_PROGRESS,
      ContractStatus.CLIENT_CONFIRMED,
      ContractStatus.READY_FOR_PAYOUT,
    ]);

    if (!completableStatuses.has(contract.status)) {
      throw new BadRequestException(
        'Contract must be in progress before completion can be confirmed',
      );
    }

    if (!contract.startedAt) {
      throw new BadRequestException(
        'Contract must be activated before completion can be confirmed.',
      );
    }

    if (isClient && contract.clientConfirmedCompletion) {
      throw new BadRequestException('Client has already confirmed completion.');
    }

    if (!isClient && contract.artisanConfirmedCompletion) {
      throw new BadRequestException(
        'Artisan has already acknowledged completion.',
      );
    }

    const bothConfirmed = isClient
      ? contract.artisanConfirmedCompletion
      : contract.clientConfirmedCompletion;

    return this.prisma.contract.update({
      where: { id: contractId },
      data: {
        clientConfirmedCompletion: isClient ? true : undefined,
        clientConfirmedAt: isClient ? new Date() : undefined,
        artisanConfirmedCompletion: isClient ? undefined : true,
        artisanConfirmedAt: isClient ? undefined : new Date(),
        status: bothConfirmed
          ? ContractStatus.READY_FOR_PAYOUT
          : isClient
            ? ContractStatus.CLIENT_CONFIRMED
            : ContractStatus.IN_PROGRESS,
      },
      include: this.contractInclude,
    });
  }

  async assertReadyForPayout(contractId: string, userId: string) {
    const contract = await this.getContractOrThrow(contractId);

    if (contract.clientId !== userId) {
      throw new ForbiddenException('Only the client can trigger payout');
    }

    if (contract.status !== ContractStatus.READY_FOR_PAYOUT) {
      throw new BadRequestException(
        'Contract must be READY_FOR_PAYOUT before funds can be released',
      );
    }

    if (!contract.artisan.artisanVerified) {
      throw new BadRequestException(
        'Artisan verification is required before payout.',
      );
    }

    return contract;
  }

  async markPayoutInitiated(contractId: string) {
    await this.getContractOrThrow(contractId);

    return this.prisma.contract.update({
      where: { id: contractId },
      data: {
        payoutRequestedAt: new Date(),
      },
      include: this.contractInclude,
    });
  }

  async markPaidOut(contractId: string) {
    await this.getContractOrThrow(contractId);

    return this.prisma.contract.update({
      where: { id: contractId },
      data: {
        escrowReleased: true,
        escrowReleasedAt: new Date(),
        paidOutAt: new Date(),
        completedAt: new Date(),
        platformFeeDeducted: true,
        status: ContractStatus.PAID_OUT,
      },
      include: this.contractInclude,
    });
  }

  async recordPayoutFailure(contractId: string, reason?: string) {
    await this.getContractOrThrow(contractId);

    return this.prisma.contract.update({
      where: { id: contractId },
      data: {
        payoutFailureReason: reason || null,
        status: ContractStatus.READY_FOR_PAYOUT,
      },
      include: this.contractInclude,
    });
  }

  async refundContract(contractId: string, userId: string, reason?: string) {
    const contract = await this.getContractOrThrow(contractId);

    const canRefund =
      contract.clientId === userId ||
      contract.status === ContractStatus.DISPUTED;

    if (!canRefund) {
      throw new ForbiddenException('Only the client can request a refund');
    }

    const finalStatuses = new Set<ContractStatus>([
      ContractStatus.PAID_OUT,
      ContractStatus.REFUNDED,
    ]);

    if (finalStatuses.has(contract.status)) {
      throw new BadRequestException(
        'Refund cannot be requested after final settlement',
      );
    }

    return this.prisma.contract.update({
      where: { id: contractId },
      data: {
        refundReason: reason || null,
      },
      include: this.contractInclude,
    });
  }

  async markRefunded(contractId: string, reason?: string) {
    await this.getContractOrThrow(contractId);

    return this.prisma.contract.update({
      where: { id: contractId },
      data: {
        refundedAt: new Date(),
        cancelledAt: new Date(),
        refundReason: reason || null,
        status: ContractStatus.REFUNDED,
      },
      include: this.contractInclude,
    });
  }

  async markDisputed(contractId: string) {
    await this.getContractOrThrow(contractId);

    return this.prisma.contract.update({
      where: { id: contractId },
      data: {
        status: ContractStatus.DISPUTED,
      },
      include: this.contractInclude,
    });
  }

  async getContract(contractId: string, userId: string) {
    const contract = await this.getContractOrThrow(contractId);

    if (contract.clientId !== userId && contract.artisanId !== userId) {
      throw new ForbiddenException(
        'Only contract parties can view contract details',
      );
    }

    return contract;
  }

  async getUserContracts(userId: string, status?: ContractStatus) {
    const where: Record<string, unknown> = {
      OR: [{ clientId: userId }, { artisanId: userId }],
    };

    if (status) {
      where.status = status;
    }

    return this.prisma.contract.findMany({
      where,
      include: this.contractInclude,
      orderBy: {
        createdAt: 'desc',
      },
    });
  }
}
