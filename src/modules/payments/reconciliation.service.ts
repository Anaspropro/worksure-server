import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class NightlyReconciliationService {
  private readonly logger = new Logger(NightlyReconciliationService.name);

  constructor(private readonly prisma: PrismaService) {}

  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async handleNightlyReconciliation() {
    this.logger.log('Starting Nightly Reconciliation Job...');

    try {
      // 1. Calculate the total internal escrow balance
      const systemEscrowAccounts = await this.prisma.ledgerAccount.findMany({
        where: { type: 'SYSTEM_ESCROW' },
      });

      const internalEscrowBalance = systemEscrowAccounts.reduce(
        (acc, account) => acc + account.balance,
        0,
      );

      this.logger.log(`Internal System Escrow Balance: ${internalEscrowBalance}`);

      // 2. Mock: Fetch the actual balance from the payment gateway (Paystack)
      // In a real scenario, this would call the Paystack API via a dedicated client.
      const externalGatewayBalance = await this.fetchPaystackBalance();

      // 3. Compare balances
      const discrepancy = externalGatewayBalance - internalEscrowBalance;

      if (discrepancy !== 0) {
        this.logger.warn(
          `Reconciliation discrepancy detected! Internal: ${internalEscrowBalance}, External: ${externalGatewayBalance}, Difference: ${discrepancy}`,
        );
        // Log this discrepancy in an Audit table or send an alert
        await this.prisma.auditLog.create({
          data: {
            id: crypto.randomUUID(),
            action: 'NIGHTLY_RECONCILIATION_DISCREPANCY',
            entityType: 'REPORT',
            entityId: 'SYSTEM',
            performedBy: 'SYSTEM',
            performedAt: new Date(),
            metadata: {
              internalBalance: internalEscrowBalance,
              externalBalance: externalGatewayBalance,
              discrepancy,
            },
          },
        });
      } else {
        this.logger.log('Reconciliation successful. No discrepancies found.');
        await this.prisma.auditLog.create({
          data: {
            id: crypto.randomUUID(),
            action: 'NIGHTLY_RECONCILIATION_SUCCESS',
            entityType: 'REPORT',
            entityId: 'SYSTEM',
            performedBy: 'SYSTEM',
            performedAt: new Date(),
            metadata: {
              balance: internalEscrowBalance,
            },
          },
        });
      }
    } catch (error) {
      this.logger.error('Nightly Reconciliation Job failed', error);
    }
  }

  /**
   * Stub for fetching actual balance from Paystack
   * Resolves with a simulated balance equal to internal balance for now.
   */
  private async fetchPaystackBalance(): Promise<number> {
    const systemEscrowAccounts = await this.prisma.ledgerAccount.findMany({
      where: { type: 'SYSTEM_ESCROW' },
    });

    const internalBalance = systemEscrowAccounts.reduce(
      (acc, account) => acc + account.balance,
      0,
    );

    // Simulating API call latency
    return new Promise((resolve) => {
      setTimeout(() => resolve(internalBalance), 1000);
    });
  }
}
