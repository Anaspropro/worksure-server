import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { PaymentsService } from './payments.service';
import { DisputeDecision } from '../../generated/prisma';

@Injectable()
export class PaymentsListener {
  private readonly logger = new Logger(PaymentsListener.name);

  constructor(private readonly paymentsService: PaymentsService) {}

  @OnEvent('DISPUTE_RESOLVED')
  async handleDisputeResolved(event: any) {
    this.logger.log(`Handling DISPUTE_RESOLVED for dispute ${event.disputeId}`);
    try {
      if (event.outcome === DisputeDecision.CLIENT_WINS) {
        await this.paymentsService.refundContract(
          event.contractId,
          event.resolvedBy, // The admin ID who resolved it
          true, // isAdmin = true
          `Dispute ${event.disputeId} resolved: refund to client`,
        );
      } else if (event.outcome === DisputeDecision.ARTISAN_WINS) {
        await this.paymentsService.releaseEscrowByAdmin(
          event.contractId,
          `Dispute ${event.disputeId} resolved: payout to artisan`,
        );
      } else if (
        event.outcome === DisputeDecision.SPLIT_DECISION &&
        event.resolutionSplit
      ) {
        // Handle split logic (not yet implemented in PaymentsService directly, but would be called here)
        this.logger.warn(
          `Split decision payout for dispute ${event.disputeId} requires manual processing`,
        );
      }
    } catch (err) {
      this.logger.error(
        `Failed to process financial payout for resolved dispute ${event.disputeId}`,
        err instanceof Error ? err.stack : undefined,
      );
    }
  }
}
