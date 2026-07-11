import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../../database/prisma.service';
import { ProposalStatus } from '../../generated/prisma';

@Injectable()
export class ProposalsCron {
  private readonly logger = new Logger(ProposalsCron.name);

  constructor(private readonly prisma: PrismaService) {}

  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async expireOldProposals() {
    this.logger.log('Running job to expire old proposals...');

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const result = await this.prisma.proposal.updateMany({
      where: {
        status: { in: [ProposalStatus.SUBMITTED, ProposalStatus.VIEWED, ProposalStatus.SHORTLISTED] },
        createdAt: { lt: thirtyDaysAgo },
      },
      data: {
        status: ProposalStatus.EXPIRED,
      },
    });

    if (result.count > 0) {
      this.logger.log(`Expired ${result.count} stale proposals.`);
    }
  }
}
