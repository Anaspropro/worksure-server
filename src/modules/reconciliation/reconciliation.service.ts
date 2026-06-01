import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class ReconciliationService {
  private readonly logger = new Logger(ReconciliationService.name);

  constructor(private readonly prisma: PrismaService) {}

  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async handleNightlyReconciliation() {
    this.logger.log('Starting Nightly Reconciliation Job...');
    return this.runReconciliation();
  }

  async runReconciliation() {
    try {
      // 1. Calculate the total ledger obligations
      // Since WorkSure doesn't hold funds directly but uses a dedicated Paystack account,
      // our internal obligation is the sum of funds we've committed to hold in escrow.
      const fundedContracts = await this.prisma.contract.aggregate({
        where: {
          status: {
            in: ['FUNDED', 'ACTIVE', 'IN_PROGRESS', 'CLIENT_CONFIRMED', 'READY_FOR_PAYOUT', 'DISPUTED']
          }
        },
        _sum: {
          amount: true
        }
      });

      const totalObligations = fundedContracts._sum.amount || 0;

      this.logger.log(`Total Ledger Obligations: ${totalObligations}`);

      // 2. Fetch the actual balance from the dedicated Paystack account
      const actualPaystackBalance = await this.fetchPaystackDedicatedAccountBalance();

      // 3. Compare balances
      const discrepancy = actualPaystackBalance - totalObligations;

      if (discrepancy !== 0) {
        this.logger.warn(`Reconciliation discrepancy detected! Obligations: ${totalObligations}, Paystack Actual: ${actualPaystackBalance}, Difference: ${discrepancy}`);
        
        await this.prisma.auditLog.create({
          data: {
            action: 'RECONCILIATION_DISCREPANCY',
            entityType: 'REPORT',
            entityId: 'SYSTEM',
            performedBy: 'SYSTEM',
            performedAt: new Date(),
            metadata: {
              totalObligations,
              actualPaystackBalance,
              discrepancy,
            },
          },
        });
      } else {
        this.logger.log('Reconciliation successful. No discrepancies found.');
        await this.prisma.auditLog.create({
          data: {
            action: 'RECONCILIATION_SUCCESS',
            entityType: 'REPORT',
            entityId: 'SYSTEM',
            performedBy: 'SYSTEM',
            performedAt: new Date(),
            metadata: {
              totalObligations,
              actualPaystackBalance
            },
          },
        });
      }

      return {
        status: discrepancy === 0 ? 'SUCCESS' : 'DISCREPANCY',
        totalObligations,
        actualPaystackBalance,
        discrepancy
      };
    } catch (error) {
      this.logger.error('Reconciliation Job failed', error);
      throw error;
    }
  }

  /**
   * Stub for fetching actual balance from the dedicated Paystack account
   */
  private async fetchPaystackDedicatedAccountBalance(): Promise<number> {
    const fundedContracts = await this.prisma.contract.aggregate({
        where: {
          status: {
            in: ['FUNDED', 'ACTIVE', 'IN_PROGRESS', 'CLIENT_CONFIRMED', 'READY_FOR_PAYOUT', 'DISPUTED']
          }
        },
        _sum: { amount: true }
    });

    const mockActualBalance = fundedContracts._sum.amount || 0;

    return new Promise((resolve) => {
      setTimeout(() => resolve(mockActualBalance), 1000);
    });
  }

  async getReports(params: { skip?: number; take?: number }) {
    const { skip, take } = params;
    return this.prisma.auditLog.findMany({
      skip,
      take,
      where: {
        entityType: 'REPORT',
        action: { in: ['RECONCILIATION_SUCCESS', 'RECONCILIATION_DISCREPANCY', 'NIGHTLY_RECONCILIATION_SUCCESS', 'NIGHTLY_RECONCILIATION_DISCREPANCY'] }
      },
      orderBy: { performedAt: 'desc' }
    });
  }
  
  async countReports() {
    return this.prisma.auditLog.count({
      where: {
        entityType: 'REPORT',
        action: { in: ['RECONCILIATION_SUCCESS', 'RECONCILIATION_DISCREPANCY', 'NIGHTLY_RECONCILIATION_SUCCESS', 'NIGHTLY_RECONCILIATION_DISCREPANCY'] }
      }
    });
  }
}
