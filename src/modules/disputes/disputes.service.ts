import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { v7 as uuidv7 } from 'uuid';
import { PrismaService } from '../../database/prisma.service';
import {
  DisputeDecision,
  DisputeStatus,
  EvidenceType,
} from '../../generated/prisma';
import { ContractsService } from '../contracts/contracts.service';
import { PaymentsService } from '../payments/payments.service';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { DomainEventName } from '../../common/events/domain.events';
import {
  DisputeOpenedEvent,
  DisputeEvidenceSubmittedEvent,
  DisputeResolvedEvent,
  DisputeStateChangedEvent,
} from './events/disputes.events';

@Injectable()
export class DisputesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly contractsService: ContractsService,
    private readonly paymentsService: PaymentsService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async createDispute(
    initiatorId: string,
    amountDisputed: number,
    reason: string,
    description: string,
    contractId: string,
  ) {
    const contract = await this.prisma.contract.findUnique({
      where: { id: contractId },
    });

    if (!contract) {
      throw new NotFoundException('Contract not found');
    }

    if (
      contract.clientId !== initiatorId &&
      contract.artisanId !== initiatorId
    ) {
      throw new ForbiddenException(
        'You can only create disputes for contracts you participate in',
      );
    }

    const existingDispute = await this.prisma.dispute.findFirst({
      where: {
        contractId,
        status: {
          not: DisputeStatus.CLOSED,
        },
      },
    });

    if (existingDispute) {
      throw new BadRequestException(
        'An active dispute already exists for this contract',
      );
    }

    const dispute = await this.prisma.dispute.create({
      data: {
        id: uuidv7(),
        contractId,
        initiatorId,
        clientId: contract.clientId,
        artisanId: contract.artisanId,
        amount: amountDisputed,
        reason,
        description,
        status: DisputeStatus.OPEN,
        history: {
          create: {
            action: 'DISPUTE_OPENED',
            by: initiatorId,
            notes: 'Dispute initiated',
          },
        },
      },
    });

    await this.contractsService.markDisputed(contractId);

    this.eventEmitter.emit(
      DomainEventName.DISPUTE_RAISED,
      new DisputeOpenedEvent(dispute.id, contractId, initiatorId),
    );

    return dispute;
  }

  async submitEvidence(
    disputeId: string,
    submittedBy: string,
    type: EvidenceType,
    url?: string,
    metadata?: Record<string, any>,
  ) {
    const dispute = await this.prisma.dispute.findUnique({
      where: { id: disputeId },
    });

    if (!dispute) {
      throw new NotFoundException('Dispute not found');
    }

    if (dispute.clientId !== submittedBy && dispute.artisanId !== submittedBy) {
      throw new ForbiddenException('Only participants can submit evidence');
    }

    if (
      dispute.status === DisputeStatus.ADMIN_INVESTIGATION ||
      dispute.status === DisputeStatus.RESOLVED ||
      dispute.status === DisputeStatus.CLOSED
    ) {
      throw new BadRequestException(
        'Evidence collection is locked for this dispute',
      );
    }

    const evidence = await this.prisma.disputeEvidence.create({
      data: {
        id: uuidv7(),
        disputeId,
        submittedBy,
        type,
        url,
        metadata: metadata || {},
      },
    });

    await this.prisma.disputeHistory.create({
      data: {
        disputeId,
        action: 'EVIDENCE_SUBMITTED',
        by: submittedBy,
        notes: `Evidence of type ${type} submitted`,
      },
    });

    this.eventEmitter.emit(
      'DISPUTE_EVIDENCE_SUBMITTED',
      new DisputeEvidenceSubmittedEvent(dispute.id, evidence.id, submittedBy),
    );

    return evidence;
  }

  async changeState(
    disputeId: string,
    newState: DisputeStatus,
    changedBy: string,
    notes?: string,
  ) {
    const dispute = await this.prisma.dispute.findUnique({
      where: { id: disputeId },
    });

    if (!dispute) {
      throw new NotFoundException('Dispute not found');
    }

    const updatedDispute = await this.prisma.dispute.update({
      where: { id: disputeId },
      data: {
        status: newState,
        history: {
          create: {
            action: 'STATE_CHANGED',
            by: changedBy,
            notes:
              notes || `State changed from ${dispute.status} to ${newState}`,
            metadata: { oldState: dispute.status, newState },
          },
        },
      },
    });

    this.eventEmitter.emit(
      'DISPUTE_STATE_CHANGED',
      new DisputeStateChangedEvent(
        disputeId,
        dispute.status,
        newState,
        changedBy,
      ),
    );

    return updatedDispute;
  }

  async resolveDispute(
    disputeId: string,
    decision: DisputeDecision,
    resolutionNotes: string,
    resolvedBy: string,
    resolutionSplit?: Record<string, number>,
  ) {
    const dispute = await this.prisma.dispute.findUnique({
      where: { id: disputeId },
    });

    if (!dispute) {
      throw new NotFoundException('Dispute not found');
    }

    if (
      dispute.status === DisputeStatus.RESOLVED ||
      dispute.status === DisputeStatus.CLOSED
    ) {
      throw new BadRequestException('Dispute is already resolved or closed');
    }

    const updatedDispute = await this.prisma.dispute.update({
      where: { id: disputeId },
      data: {
        status: DisputeStatus.RESOLVED,
        resolutionDecision: decision,
        resolutionNotes,
        resolvedBy,
        resolvedAt: new Date(),
        resolutionSplit: resolutionSplit || {},
        history: {
          create: {
            action: 'DISPUTE_RESOLVED',
            by: resolvedBy,
            notes: resolutionNotes,
            metadata: { decision, resolutionSplit },
          },
        },
      },
    });

    this.eventEmitter.emit(
      'DISPUTE_RESOLVED',
      new DisputeResolvedEvent(
        dispute.id,
        dispute.contractId,
        resolvedBy,
        decision,
        resolutionSplit || null,
      ),
    );

    return updatedDispute;
  }

  async getDisputesByUser(userId: string) {
    return this.prisma.dispute.findMany({
      where: {
        OR: [{ clientId: userId }, { artisanId: userId }],
      },
      include: {
        client: { select: { id: true, name: true, email: true } },
        artisan: { select: { id: true, name: true, email: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }

  async getDisputeById(disputeId: string, userId?: string, userRole?: string) {
    const dispute = await this.prisma.dispute.findUnique({
      where: { id: disputeId },
      include: {
        client: { select: { id: true, name: true, email: true } },
        artisan: { select: { id: true, name: true, email: true } },
        evidence: { orderBy: { createdAt: 'desc' } },
        history: { orderBy: { at: 'desc' } },
      },
    });

    if (!dispute) {
      throw new NotFoundException('Dispute not found');
    }

    if (
      userId &&
      userRole !== 'ADMIN' &&
      userId !== dispute.clientId &&
      userId !== dispute.artisanId
    ) {
      throw new ForbiddenException(
        'Access denied: You can only view disputes you participate in',
      );
    }

    return dispute;
  }
}
