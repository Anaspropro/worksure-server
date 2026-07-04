import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { PrismaService } from '../../../database/prisma.service';
import { v7 as uuidv7 } from 'uuid';
import {
  ContractFundedEvent,
  DisputeRaisedEvent,
  DomainEventName,
  PaymentReleasedEvent,
  ProposalAcceptedEvent,
} from '../../../common/events/domain.events';
import { AuditEntityType } from '../../../generated/prisma';

@Injectable()
export class AuditEventListener {
  private readonly logger = new Logger(AuditEventListener.name);

  constructor(private readonly prisma: PrismaService) {}

  private async logAudit(
    action: string,
    entityType: AuditEntityType,
    entityId: string,
    performedBy: string,
    metadata?: Record<string, any>,
  ) {
    try {
      await this.prisma.auditLog.create({
        data: {
          id: uuidv7(),
          action,
          entityType,
          entityId,
          performedBy,
          performedAt: new Date(),
          metadata,
        },
      });
    } catch (error) {
      // Isolate failures so they don't crash the event emitter loop
      this.logger.error(`Failed to create audit log for ${action}: ${error.message}`, error.stack);
    }
  }

  @OnEvent(DomainEventName.CONTRACT_FUNDED)
  async handleContractFunded(event: ContractFundedEvent) {
    await this.logAudit(
      'CONTRACT_FUNDED',
      AuditEntityType.CONTRACT,
      event.contractId,
      event.clientId, // Client performed the funding
      { amount: event.amount, contractReference: event.contractReference }
    );
  }

  @OnEvent(DomainEventName.PAYMENT_PROCESSED)
  async handlePaymentProcessed(event: PaymentReleasedEvent) {
    await this.logAudit(
      'PAYMENT_RELEASED',
      AuditEntityType.CONTRACT, // Payment maps back to contract typically, but we could add PAYMENT to AuditEntityType
      event.contractId,
      'SYSTEM', // Typically a system process or client approval releases payment
      { amount: event.amount, paymentId: event.paymentId }
    );
  }

  @OnEvent(DomainEventName.PROPOSAL_ACCEPTED)
  async handleProposalAccepted(event: ProposalAcceptedEvent) {
    await this.logAudit(
      'PROPOSAL_ACCEPTED',
      AuditEntityType.CONTRACT, // Tied to the contract creation
      event.proposalId,
      event.clientId,
      { jobId: event.jobId, artisanId: event.artisanId }
    );
  }

  @OnEvent(DomainEventName.DISPUTE_RAISED)
  async handleDisputeRaised(event: DisputeRaisedEvent) {
    await this.logAudit(
      'DISPUTE_RAISED',
      AuditEntityType.DISPUTE,
      event.disputeId,
      event.raisedById,
      { contractId: event.contractId, contractReference: event.contractReference }
    );
  }
}
