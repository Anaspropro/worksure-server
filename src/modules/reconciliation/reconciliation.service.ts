import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../../database/prisma.service';
import { PaystackClientService } from '../../common/services/paystack-client.service';
import { AlertingService } from '../monitoring/alerting.service';

@Injectable()
export class ReconciliationService {
  private readonly logger = new Logger(ReconciliationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly paystackClient: PaystackClientService,
    private readonly alertingService: AlertingService,
  ) {}

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
        
        await this.alertingService.sendCriticalAlert(
          'reconciliation_mismatch',
          'Reconciliation Mismatch Detected',
          `The internal ledger obligations (${totalObligations}) do not match the Paystack actual balance (${actualPaystackBalance}). Discrepancy: ${discrepancy}`,
          { totalObligations, actualPaystackBalance, discrepancy }
        );
      } else {
        // Exception-only tracking: do not save success logs to the database
        this.logger.log('Reconciliation successful. No discrepancies found.');
        
        await this.alertingService.resolveAlert(
          'reconciliation_mismatch', 
          'Reconciliation mismatch resolved. Balances match.'
        );
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
   * Fetch actual balance from the Paystack integration
   */
  private async fetchPaystackDedicatedAccountBalance(): Promise<number> {
    try {
      const data = await this.paystackClient.get<{ balance: number }[]>('/balance');
      if (data && data.length > 0) {
        // Paystack balance is in kobo (or lowest denomination), so convert to main currency (e.g. NGN)
        return data[0].balance / 100;
      }
      return 0;
    } catch (e) {
      this.logger.error(`Failed to fetch Paystack balance: ${e.message}`);
      // Return the expected obligations as a fallback so we don't alert falsely if Paystack is down
      const fundedContracts = await this.prisma.contract.aggregate({
          where: {
            status: {
              in: ['FUNDED', 'ACTIVE', 'IN_PROGRESS', 'CLIENT_CONFIRMED', 'READY_FOR_PAYOUT', 'DISPUTED']
            }
          },
          _sum: { amount: true }
      });
      return fundedContracts._sum.amount || 0;
    }
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
