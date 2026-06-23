import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { v7 as uuidv7 } from 'uuid';
import { PrismaService } from '../../database/prisma.service';
import {
  AuditEntityType,
  ContractStatus,
  Prisma,
} from '../../generated/prisma';

import { IdempotencyService } from '../../common/services/idempotency.service';

@Injectable()
export class ContractsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly idempotency: IdempotencyService,
  ) {}
  private readonly contractTransitionNamespace = 'contract_transition';

  private buildTransitionKey(
    action: string,
    contractId: string,
    externalRef?: string,
  ) {
    return externalRef
      ? `contract:${contractId}:${action}:${externalRef}`
      : `contract:${contractId}:${action}`;
  }

  // Removed duplicate lock methods in favor of IdempotencyService

  private async recordTransitionAudit(
    contractId: string,
    previousStatus: ContractStatus,
    nextStatus: ContractStatus,
    context?: {
      actorId?: string;
      action?: string;
      reason?: string;
      source?: string;
      externalReference?: string;
      changedFields?: string[];
    },
  ) {
    await this.prisma.auditLog.create({
      data: {
        id: uuidv7(),
        action: context?.action ?? 'CONTRACT_STATUS_TRANSITION',
        entityType: AuditEntityType.CONTRACT,
        entityId: contractId,
        performedBy: context?.actorId ?? 'system',
        performedAt: new Date(),
        metadata: {
          previousStatus,
          nextStatus,
          reason: context?.reason ?? null,
          source: context?.source ?? 'contracts_service',
          externalReference: context?.externalReference ?? null,
          changedFields: context?.changedFields ?? [],
        },
      },
    });
  }

  // Centralized state machine validation
  private readonly validStateTransitions: Record<
    ContractStatus,
    ContractStatus[]
  > = {
    [ContractStatus.DRAFT]: [
      ContractStatus.PENDING_PAYMENT,
      ContractStatus.CANCELLED,
    ],
    [ContractStatus.PENDING_PAYMENT]: [
      ContractStatus.FUNDED,
      ContractStatus.CANCELLED,
      ContractStatus.PAYMENT_FAILED,
      ContractStatus.EXPIRED,
    ],
    [ContractStatus.FUNDED]: [ContractStatus.ACTIVE, ContractStatus.CANCELLED],
    [ContractStatus.ACTIVE]: [
      ContractStatus.IN_PROGRESS,
      ContractStatus.DISPUTED,
      ContractStatus.CANCELLED,
    ],
    [ContractStatus.IN_PROGRESS]: [
      ContractStatus.CLIENT_CONFIRMED,
      ContractStatus.DISPUTED,
      ContractStatus.CANCELLED,
    ],
    [ContractStatus.CLIENT_CONFIRMED]: [
      ContractStatus.READY_FOR_PAYOUT,
      ContractStatus.DISPUTED,
      ContractStatus.IN_PROGRESS,
    ],
    [ContractStatus.READY_FOR_PAYOUT]: [
      ContractStatus.PAID_OUT,
      ContractStatus.DISPUTED,
    ],
    [ContractStatus.DISPUTED]: [
      ContractStatus.REFUNDED,
      ContractStatus.PAID_OUT,
    ],
    [ContractStatus.PAID_OUT]: [], // Terminal state
    [ContractStatus.COMPLETED]: [], // Terminal state
    [ContractStatus.REFUNDED]: [], // Terminal state
    [ContractStatus.CANCELLED]: [], // Terminal state
    [ContractStatus.PAYMENT_FAILED]: [
      ContractStatus.PENDING_PAYMENT,
      ContractStatus.CANCELLED,
    ], // Can retry or cancel
    [ContractStatus.EXPIRED]: [], // Terminal state
  };

  private validateStateTransition(
    currentStatus: ContractStatus,
    newStatus: ContractStatus,
  ): void {
    const validTransitions = this.validStateTransitions[currentStatus];
    if (!validTransitions.includes(newStatus)) {
      throw new BadRequestException(
        `Invalid state transition from ${currentStatus} to ${newStatus}`,
      );
    }
  }

  private async transitionContractStatusWithClient(
    prismaClient: Prisma.TransactionClient | PrismaService,
    contractId: string,
    newStatus: ContractStatus,
    data?: Prisma.ContractUpdateInput,
    context?: {
      actorId?: string;
      action?: string;
      reason?: string;
      source?: string;
      externalReference?: string;
    },
  ) {
    const contract = await prismaClient.contract.findUnique({
      where: { id: contractId },
      select: { status: true, paystackReference: true, jobId: true },
    });

    if (!contract) {
      throw new NotFoundException('Contract not found');
    }

    this.validateStateTransition(contract.status, newStatus);

    const updatedContract = await prismaClient.contract.update({
      where: { id: contractId },
      data: {
        status: newStatus,
        updatedAt: new Date(),
        ...(data ?? {}),
      },
      include: this.contractInclude,
    });

    // Synchronize Job status if contract reaches a successful terminal state
    if (newStatus === ContractStatus.COMPLETED || newStatus === ContractStatus.PAID_OUT) {
      await prismaClient.job.update({
        where: { id: contract.jobId },
        data: { status: 'COMPLETED' },
      });
    }

    await this.recordTransitionAudit(contractId, contract.status, newStatus, {
      actorId: context?.actorId,
      action: context?.action,
      reason: context?.reason,
      source: context?.source,
      externalReference:
        context?.externalReference ?? contract.paystackReference ?? undefined,
      changedFields: data ? Object.keys(data) : [],
    });

    return updatedContract;
  }

  private async transitionContractStatus(
    contractId: string,
    newStatus: ContractStatus,
    data?: Prisma.ContractUpdateInput,
    context?: {
      actorId?: string;
      action?: string;
      reason?: string;
      source?: string;
      externalReference?: string;
    },
  ) {
    return this.transitionContractStatusWithClient(
      this.prisma,
      contractId,
      newStatus,
      data,
      context,
    );
  }

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

  private readonly contractListInclude = {
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
      },
    },
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

  private async findContractMetadata(contractId: string) {
    const contract = await this.prisma.contract.findUnique({
      where: { id: contractId },
      select: {
        id: true,
        status: true,
        clientId: true,
        artisanId: true,
        amount: true,
        activatedAt: true,
        startedAt: true,
        paystackReference: true,
        artisan: {
          select: {
            artisanVerified: true,
          },
        },
      },
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
          id: uuidv7(),
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
        data: { contractId: newContract.id, status: 'IN_PROGRESS' },
      });

      const otherProposals = await tx.proposal.findMany({
        where: {
          jobId: proposal.jobId,
          id: { not: proposalId },
          status: 'PENDING',
        },
      });

      if (otherProposals.length > 0) {
        await tx.proposal.updateMany({
          where: {
            jobId: proposal.jobId,
            id: { not: proposalId },
            status: 'PENDING',
          },
          data: { status: 'REJECTED' },
        });

        const notificationsData = otherProposals.map(p => ({
          id: uuidv7(),
          userId: p.artisanId,
          title: 'Proposal Rejected',
          message: 'The client has awarded the contract for this job to another artisan.',
          createdAt: new Date(),
        }));
        
        await tx.notification.createMany({
          data: notificationsData,
        });
      }

      return newContract;
    });

    return contract;
  }

  async activateContract(contractId: string, userId: string) {
    const contract = await this.findContractMetadata(contractId);

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

    const operationKey = this.buildTransitionKey(
      'activate',
      contractId,
      userId,
    );
    const acquired = await this.idempotency.tryAcquire(
      operationKey,
      'contract_transition',
    );
    if (!acquired) {
      return this.getContractOrThrow(contractId);
    }

    try {
      const updatedContract = await this.transitionContractStatus(
        contractId,
        ContractStatus.IN_PROGRESS,
        {
          activatedAt: contract.activatedAt ?? new Date(),
          startedAt: contract.startedAt ?? new Date(),
        },
        {
          actorId: userId,
          action: 'CONTRACT_ACTIVATED',
          source: 'contracts.activate',
        },
      );
      await this.idempotency.complete(
        operationKey,
        this.contractTransitionNamespace,
      );
      return updatedContract;
    } catch (error) {
      await this.idempotency.release(
        operationKey,
        this.contractTransitionNamespace,
      );
      throw error;
    }
  }

  async markFunded(
    contractId: string,
    paymentId: string,
    paystackReference: string,
    authorizationUrl?: string | null,
    accessCode?: string | null,
  ) {
    await this.getContractOrThrow(contractId);
    const operationKey = this.buildTransitionKey(
      'funded',
      contractId,
      paystackReference || paymentId,
    );
    const acquired = await this.idempotency.tryAcquire(
      operationKey,
      'contract_transition',
    );
    if (!acquired) {
      return this.getContractOrThrow(contractId);
    }

    try {
      const updatedContract = await this.transitionContractStatus(
        contractId,
        ContractStatus.FUNDED,
        {
          fundedAt: new Date(),
          paystackReference: paystackReference || null,
          paystackAuthorizationUrl: authorizationUrl || null,
          paystackAccessCode: accessCode || null,
          fundedPaymentId: paymentId,
        },
        {
          actorId: 'system',
          action: 'CONTRACT_FUNDED',
          source: 'payments.verify',
          externalReference: paystackReference || paymentId,
        },
      );
      await this.idempotency.complete(
        operationKey,
        this.contractTransitionNamespace,
      );
      return updatedContract;
    } catch (error) {
      await this.idempotency.release(
        operationKey,
        this.contractTransitionNamespace,
      );
      throw error;
    }
  }

  async markPaymentInitializationRequested(
    contractId: string,
    paystackReference: string,
    authorizationUrl?: string | null,
    accessCode?: string | null,
  ) {
    const contract = await this.findContractMetadata(contractId);
    const targetStatus = ContractStatus.PENDING_PAYMENT;

    if (contract.status !== targetStatus) {
      return this.transitionContractStatus(contractId, targetStatus, {
        paystackReference: paystackReference || null,
        paystackAuthorizationUrl: authorizationUrl || null,
        paystackAccessCode: accessCode || null,
      });
    }

    return this.prisma.contract.update({
      where: { id: contractId },
      data: {
        paystackReference: paystackReference || null,
        paystackAuthorizationUrl: authorizationUrl || null,
        paystackAccessCode: accessCode || null,
      },
      include: this.contractInclude,
    });
  }

  async confirmCompletion(
    contractId: string,
    userId: string,
    isClient: boolean,
  ) {
    return this.prisma.$transaction(async (tx) => {
      // 1. Lock the row to prevent race conditions during concurrent confirmation attempts
      await tx.$queryRaw`SELECT id FROM "Contract" WHERE "id" = ${contractId} FOR UPDATE`;

      const contract = await tx.contract.findUnique({
        where: { id: contractId },
        include: this.contractInclude,
      });

      if (!contract) {
        throw new NotFoundException('Contract not found');
      }

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
        throw new BadRequestException(
          'Client has already confirmed completion.',
        );
      }

      if (!isClient && contract.artisanConfirmedCompletion) {
        throw new BadRequestException(
          'Artisan has already acknowledged completion.',
        );
      }

      const bothConfirmed = isClient
        ? contract.artisanConfirmedCompletion
        : contract.clientConfirmedCompletion;

      const nextStatus = bothConfirmed
        ? ContractStatus.READY_FOR_PAYOUT
        : isClient
          ? ContractStatus.CLIENT_CONFIRMED
          : ContractStatus.IN_PROGRESS;

      return this.transitionContractStatusWithClient(
        tx,
        contractId,
        nextStatus,
        {
          clientConfirmedCompletion: isClient ? true : undefined,
          clientConfirmedAt: isClient ? new Date() : undefined,
          artisanConfirmedCompletion: isClient ? undefined : true,
          artisanConfirmedAt: isClient ? undefined : new Date(),
        },
        {
          actorId: userId,
          action: bothConfirmed
            ? 'CONTRACT_READY_FOR_PAYOUT'
            : isClient
              ? 'CLIENT_CONFIRMED_COMPLETION'
              : 'ARTISAN_CONFIRMED_COMPLETION',
          source: 'contracts.confirmCompletion',
        },
      );
    });
  }

  async assertReadyForPayout(contractId: string) {
    const contract = await this.findContractMetadata(contractId);

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
    await this.findContractMetadata(contractId);

    return this.prisma.contract.update({
      where: { id: contractId },
      data: {
        payoutRequestedAt: new Date(),
      },
      include: this.contractInclude,
    });
  }

  async markPaidOut(contractId: string) {
    const operationKey = this.buildTransitionKey('paid_out', contractId);
    const acquired = await this.idempotency.tryAcquire(
      operationKey,
      'contract_transition',
    );
    if (!acquired) {
      return this.getContractOrThrow(contractId);
    }

    try {
      const updatedContract = await this.transitionContractStatus(
        contractId,
        ContractStatus.PAID_OUT,
        {
          escrowReleased: true,
          escrowReleasedAt: new Date(),
          paidOutAt: new Date(),
          completedAt: new Date(),
          platformFeeDeducted: true,
        },
        {
          actorId: 'system',
          action: 'CONTRACT_PAID_OUT',
          source: 'payments.webhook',
        },
      );
      await this.idempotency.complete(
        operationKey,
        this.contractTransitionNamespace,
      );
      return updatedContract;
    } catch (error) {
      await this.idempotency.release(
        operationKey,
        this.contractTransitionNamespace,
      );
      throw error;
    }
  }

  async recordPayoutFailure(contractId: string, reason?: string) {
    const contract = await this.findContractMetadata(contractId);
    if (contract.status !== ContractStatus.READY_FOR_PAYOUT) {
      throw new BadRequestException(
        'Payout failure can only be recorded while contract is READY_FOR_PAYOUT',
      );
    }
    return this.prisma.contract.update({
      where: { id: contractId },
      data: {
        payoutFailureReason: reason || null,
        status: ContractStatus.READY_FOR_PAYOUT,
      },
      include: this.contractInclude,
    });
  }

  async refundContract(
    contractId: string,
    userId: string,
    isAdmin: boolean,
    reason?: string,
  ) {
    const contract = await this.findContractMetadata(contractId);

    const canRefund =
      isAdmin ||
      (contract.clientId === userId &&
        contract.status !== ContractStatus.DISPUTED);

    if (!canRefund) {
      throw new ForbiddenException(
        'Only the admin or client can request a refund',
      );
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
    const operationKey = this.buildTransitionKey('refunded', contractId);
    const acquired = await this.idempotency.tryAcquire(
      operationKey,
      'contract_transition',
    );
    if (!acquired) {
      return this.getContractOrThrow(contractId);
    }

    try {
      await this.transitionContractStatus(
        contractId,
        ContractStatus.REFUNDED,
        {
          refundedAt: new Date(),
          cancelledAt: new Date(),
          refundReason: reason || null,
        },
        {
          actorId: 'system',
          action: 'CONTRACT_REFUNDED',
          source: 'payments.refund',
          reason,
        },
      );
      await this.idempotency.complete(
        operationKey,
        this.contractTransitionNamespace,
      );
      return this.getContractOrThrow(contractId);
    } catch (error) {
      await this.idempotency.release(
        operationKey,
        this.contractTransitionNamespace,
      );
      throw error;
    }
  }

  async markDisputed(contractId: string) {
    const operationKey = this.buildTransitionKey('disputed', contractId);
    const acquired = await this.idempotency.tryAcquire(
      operationKey,
      'contract_transition',
    );
    if (!acquired) {
      return this.getContractOrThrow(contractId);
    }

    try {
      await this.transitionContractStatus(
        contractId,
        ContractStatus.DISPUTED,
        undefined,
        {
          actorId: 'system',
          action: 'CONTRACT_DISPUTED',
          source: 'disputes.create',
        },
      );
      await this.idempotency.complete(
        operationKey,
        this.contractTransitionNamespace,
      );
      return this.getContractOrThrow(contractId);
    } catch (error) {
      await this.idempotency.release(
        operationKey,
        this.contractTransitionNamespace,
      );
      throw error;
    }
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
      include: this.contractListInclude,
      orderBy: {
        createdAt: 'desc',
      },
      take: 50,
    });
  }
}
