import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { PrismaService } from '../../database/prisma.service';
import { DomainEventName, ContractCompletedEvent } from '../../common/events/domain.events';
import { v7 as uuidv7 } from 'uuid';

@Injectable()
export class ReviewsEventListener {
  private readonly logger = new Logger(ReviewsEventListener.name);

  constructor(private readonly prisma: PrismaService) {}

  @OnEvent(DomainEventName.CONTRACT_COMPLETED)
  async handleContractCompleted(event: ContractCompletedEvent) {
    this.logger.log(`Contract ${event.contractId} completed. Creating review eligibilities.`);

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 14); // 14 days to review

    try {
      // 1. Client reviews Artisan
      await this.prisma.reviewEligibility.create({
        data: {
          id: uuidv7(),
          contractId: event.contractId,
          userId: event.clientId,
          targetId: event.artisanId,
          expiresAt,
        },
      });

      // 2. Artisan reviews Client
      await this.prisma.reviewEligibility.create({
        data: {
          id: uuidv7(),
          contractId: event.contractId,
          userId: event.artisanId,
          targetId: event.clientId,
          expiresAt,
        },
      });
    } catch (error) {
      this.logger.error(`Failed to create review eligibilities for contract ${event.contractId}: ${error.message}`);
    }
  }
}
