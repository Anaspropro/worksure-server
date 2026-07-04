import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import {
  ContractFundedEvent,
  DisputeRaisedEvent,
  DomainEventName,
  JobPostedEvent,
  PaymentReleasedEvent,
  ProposalAcceptedEvent,
  ProposalSubmittedEvent,
} from '../../../common/events/domain.events';
import { NotificationsService } from '../../notifications/notifications.service';
import { NotificationTemplateService } from '../../notifications/notification-template.service';
import { QueueService } from '../../queue/queue.service';
import { NotificationType, NotificationPriority } from '../../notifications/dto/notification.dto';

@Injectable()
export class NotificationEventListener {
  private readonly logger = new Logger(NotificationEventListener.name);

  constructor(
    private readonly notificationsService: NotificationsService,
    private readonly templateService: NotificationTemplateService,
    private readonly queueService: QueueService,
  ) {}

  private async dispatch(
    eventName: DomainEventName,
    userId: string,
    variables: Record<string, any>,
    type: NotificationType,
    entityId?: string,
    entityType?: string,
    actionUrl?: string,
  ) {
    try {
      const content = this.templateService.generate(eventName, variables);

      // 1. In-app Notification
      await this.notificationsService.createNotification({
        userId,
        type,
        title: content.title,
        message: content.message,
        entityId,
        entityType,
        actionUrl,
        priority: NotificationPriority.HIGH,
      });

      // 2. Email (via Queue)
      if (content.emailSubject && content.emailBody) {
        // Assume we look up the user's email or the QueueService does it
        // We'll queue the email job
        await this.queueService.queueEmail({
          to: userId, // QueueService should resolve userId to email if needed
          subject: content.emailSubject,
          body: content.emailBody,
        });
      }
    } catch (error) {
      // Isolate failures so they don't crash the event emitter loop
      this.logger.error(`Failed to dispatch notification for ${eventName}: ${error.message}`, error.stack);
    }
  }

  @OnEvent(DomainEventName.JOB_POSTED)
  async handleJobPosted(event: JobPostedEvent) {
    await this.dispatch(
      DomainEventName.JOB_POSTED,
      event.clientId,
      { jobTitle: event.jobTitle },
      NotificationType.SYSTEM_UPDATE,
      event.jobId,
      'JOB',
      `/jobs/${event.jobId}`
    );
  }

  @OnEvent(DomainEventName.PROPOSAL_SUBMITTED)
  async handleProposalSubmitted(event: ProposalSubmittedEvent) {
    await this.dispatch(
      DomainEventName.PROPOSAL_SUBMITTED,
      event.clientId, // Notify the client
      { jobTitle: event.jobTitle },
      NotificationType.PROPOSAL_RECEIVED,
      event.proposalId,
      'PROPOSAL',
      `/proposals/${event.proposalId}`
    );
  }

  @OnEvent(DomainEventName.PROPOSAL_ACCEPTED)
  async handleProposalAccepted(event: ProposalAcceptedEvent) {
    await this.dispatch(
      DomainEventName.PROPOSAL_ACCEPTED,
      event.artisanId, // Notify the artisan
      { jobTitle: event.jobTitle },
      NotificationType.PROPOSAL_ACCEPTED,
      event.proposalId,
      'PROPOSAL',
      `/proposals/${event.proposalId}`
    );
  }

  @OnEvent(DomainEventName.CONTRACT_FUNDED)
  async handleContractFunded(event: ContractFundedEvent) {
    await this.dispatch(
      DomainEventName.CONTRACT_FUNDED,
      event.artisanId, // Notify the artisan
      { jobTitle: event.jobTitle, contractReference: event.contractReference },
      NotificationType.CONTRACT_FUNDED,
      event.contractId,
      'CONTRACT',
      `/contracts/${event.contractId}`
    );
  }

  @OnEvent(DomainEventName.PAYMENT_PROCESSED)
  async handlePaymentProcessed(event: PaymentReleasedEvent) {
    await this.dispatch(
      DomainEventName.PAYMENT_PROCESSED,
      event.artisanId, // Notify the artisan
      { jobTitle: event.jobTitle },
      NotificationType.PAYMENT_VERIFIED,
      event.paymentId,
      'PAYMENT',
      `/payments/${event.paymentId}`
    );
  }

  @OnEvent(DomainEventName.DISPUTE_RAISED)
  async handleDisputeRaised(event: DisputeRaisedEvent) {
    await this.dispatch(
      DomainEventName.DISPUTE_RAISED,
      event.relatedUserId, // Notify the other party
      { contractReference: event.contractReference },
      NotificationType.DISPUTE_CREATED,
      event.disputeId,
      'DISPUTE',
      `/disputes/${event.disputeId}`
    );
  }
}
