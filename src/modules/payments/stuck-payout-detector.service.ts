import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../../database/prisma.service';
import { ContractStatus } from '../../generated/prisma';
import { PaymentsService } from './payments.service';

@Injectable()
export class StuckPayoutDetectorService {
  private readonly logger = new Logger(StuckPayoutDetectorService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly paymentsService: PaymentsService,
  ) {}

  @Cron(CronExpression.EVERY_HOUR)
  async handleStuckPayouts() {
    this.logger.log('Checking for stuck payouts...');

    // Find contracts in READY_FOR_PAYOUT for more than 1 hour
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    
    const stuckContracts = await this.prisma.contract.findMany({
      where: {
        status: ContractStatus.READY_FOR_PAYOUT,
        updatedAt: {
          lt: oneHourAgo,
        },
      },
      select: { id: true },
    });

    if (stuckContracts.length === 0) {
      return;
    }

    this.logger.warn(`Found ${stuckContracts.length} stuck contracts in READY_FOR_PAYOUT status.`);

    for (const contract of stuckContracts) {
      try {
        this.logger.log(`Attempting retry for stuck contract payout: ${contract.id}`);
        await this.paymentsService.releaseEscrow(contract.id);
        this.logger.log(`Successfully recovered payout for contract: ${contract.id}`);
      } catch (error) {
        this.logger.error(
          `Retry failed for stuck contract payout ${contract.id}: ${error instanceof Error ? error.message : String(error)}`,
          error instanceof Error ? error.stack : undefined,
        );
      }
    }
  }
}
