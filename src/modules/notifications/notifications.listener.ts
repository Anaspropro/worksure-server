import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { NotificationPriority } from '../../generated/prisma';

@Injectable()
export class NotificationsListener {
  private readonly logger = new Logger(NotificationsListener.name);

  constructor(
    @InjectQueue('notification-routing-queue')
    private readonly routingQueue: Queue,
  ) {}

  private async dispatch(
    type: string,
    category: string,
    userId: string,
    payload: any,
    priority: NotificationPriority = NotificationPriority.NORMAL,
  ) {
    if (!userId) {
      this.logger.warn(`Skipping notification ${type}: no userId provided`);
      return;
    }

    await this.routingQueue.add(
      'route-notification',
      { type, category, userId, payload, priority },
      { removeOnComplete: true, removeOnFail: 100 },
    );
  }

  // Example mappings (can be expanded based on precise event shapes)

  @OnEvent('proposal.submitted')
  async handleProposalSubmitted(event: any) {
    await this.dispatch(
      'PROPOSAL_RECEIVED',
      'PROPOSALS',
      event.clientId || event.proposal?.job?.clientId,
      event,
    );
  }

  @OnEvent('proposal.accepted')
  async handleProposalAccepted(event: any) {
    await this.dispatch(
      'PROPOSAL_ACCEPTED',
      'PROPOSALS',
      event.artisanId || event.proposal?.artisanId,
      event,
      NotificationPriority.HIGH,
    );
  }

  @OnEvent('contract.funded')
  async handleContractFunded(event: any) {
    await this.dispatch(
      'CONTRACT_FUNDED',
      'CONTRACTS',
      event.artisanId || event.contract?.artisanId,
      event,
      NotificationPriority.HIGH,
    );
  }

  @OnEvent('dispute.created')
  async handleDisputeCreated(event: any) {
    // Notify admin or client/artisan depending on the payload
    if (event.targetUserId) {
      await this.dispatch(
        'DISPUTE_CREATED',
        'DISPUTES',
        event.targetUserId,
        event,
        NotificationPriority.CRITICAL,
      );
    }
  }

  @OnEvent('marketplace.verification.approved')
  async handleMarketplaceVerificationApproved(event: any) {
    await this.dispatch(
      'MARKETPLACE_VERIFICATION_APPROVED',
      'VERIFICATION',
      event.userId,
      event,
      NotificationPriority.HIGH,
    );
  }
}
