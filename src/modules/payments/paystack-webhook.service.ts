import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import {
  FinancialEventType,
  Prisma,
  TransactionStatus,
  TransactionType,
} from '../../generated/prisma';
import { ContractsService } from '../contracts/contracts.service';
import { WalletService } from '../wallet/wallet.service';
import { PaymentsService } from './payments.service';
import { EventEmitter2 } from '@nestjs/event-emitter';
import {
  DomainEventName,
  PaymentReleasedEvent,
} from '../../common/events/domain.events';

/**
 * Service dedicated to handling Paystack webhook events.
 * Extracted from PaymentsService to improve modularity and maintainability.
 */
@Injectable()
export class PaystackWebhookService {
  private readonly webhookHandlers: Record<
    string,
    (payload: any) => Promise<{ handled: boolean; event: string }>
  >;

  constructor(
    private readonly prisma: PrismaService,
    private readonly contractsService: ContractsService,
    private readonly walletService: WalletService,
    private readonly paymentsService: PaymentsService,
    private readonly eventEmitter: EventEmitter2,
  ) {
    this.webhookHandlers = {
      'charge.success': this.handleChargeSuccess.bind(this),
      'transfer.success': this.handleTransferSuccess.bind(this),
      'transfer.failed': this.handleTransferFailed.bind(this),
      'refund.processed': this.handleRefundProcessed.bind(this),
    };
  }

  /**
   * Dispatches the Paystack webhook payload to the appropriate handler.
   */
  async processPaystackWebhook(payload: any) {
    const event = payload?.event as string | undefined;

    if (!event) {
      throw new BadRequestException('Webhook event is required');
    }

    const handler = this.webhookHandlers[event];
    if (handler) {
      return handler(payload);
    }

    return { handled: false, event };
  }

  private async handleChargeSuccess(payload: any) {
    const event = 'charge.success';
    const reference = payload?.data?.reference as string | undefined;
    if (reference) {
      if (reference.startsWith('wallet_deposit_')) {
        await this.walletService.verifyWalletDeposit(null, reference);
      } else {
        await this.paymentsService.verifyPaystackPayment(reference);
      }
    }
    return { handled: true, event };
  }

  private async handleTransferSuccess(payload: any) {
    const event = 'transfer.success';
    const reference = payload?.data?.reference as string | undefined;
    const transferCode = payload?.data?.transfer_code as string | undefined;
    if (!reference) {
      return { handled: false, event };
    }

    if (reference.startsWith('payout_req_')) {
      await this.prisma.transaction.updateMany({
        where: {
          reference,
          type: TransactionType.PAYOUT,
          status: TransactionStatus.PENDING,
        },
        data: { status: TransactionStatus.COMPLETED, completedAt: new Date() },
      });
      return { handled: true, event };
    }

    await this.prisma.$transaction(async (tx) => {
      const rawLocks = await tx.$queryRaw<
        { id: string }[]
      >`SELECT id FROM "Transaction" WHERE "reference" = ${reference} FOR UPDATE`;
      if (!rawLocks || rawLocks.length === 0) return;

      const transferTx = await tx.transaction.findFirst({
        where: { reference, type: TransactionType.TRANSFER },
      });

      if (transferTx && transferTx.status !== TransactionStatus.COMPLETED) {
        const contractId =
          (transferTx.metadata as { contractId?: string } | null)?.contractId ??
          null;

        await tx.transaction.update({
          where: { id: transferTx.id },
          data: {
            status: TransactionStatus.COMPLETED,
            completedAt: new Date(),
            metadata: {
              ...(typeof transferTx.metadata === 'object' &&
              transferTx.metadata !== null
                ? transferTx.metadata
                : {}),
              transferCode: transferCode || null,
            },
          },
        });

        if (contractId) {
          // DOUBLE-ENTRY LEDGER: Payout Release
          const metadata = transferTx.metadata as {
            contractId?: string;
            platformFee?: number;
          } | null;
          const platformFee = metadata?.platformFee ?? 0;
          const payoutAmount = transferTx.amount;
          const totalAmount = payoutAmount + platformFee;

          const systemEscrow = await tx.ledgerAccount.findFirst({
            where: { type: 'SYSTEM_ESCROW' },
          });
          if (!systemEscrow) {
            throw new NotFoundException(
              'System escrow account not configured.',
            );
          }

          let artisanWallet = await tx.ledgerAccount.findUnique({
            where: { userId: transferTx.userId },
          });
          if (!artisanWallet) {
            artisanWallet = await tx.ledgerAccount.create({
              data: {
                name: 'Artisan Wallet',
                type: 'USER_WALLET',
                userId: transferTx.userId,
              },
            });
          }

          let systemFee = await tx.ledgerAccount.findFirst({
            where: { type: 'SYSTEM_FEE' },
          });
          if (!systemFee) {
            systemFee = await tx.ledgerAccount.create({
              data: {
                name: 'System Fee Account',
                type: 'SYSTEM_FEE',
              },
            });
          }

          // Create ledger entries
          await tx.ledgerEntry.create({
            data: {
              debitAccountId: systemEscrow.id,
              creditAccountId: artisanWallet.id,
              amount: payoutAmount,
              reference,
              contractId,
              description: `Payout Release to Artisan for Contract ${contractId}`,
            },
          });

          if (platformFee > 0) {
            await tx.ledgerEntry.create({
              data: {
                debitAccountId: systemEscrow.id,
                creditAccountId: systemFee.id,
                amount: platformFee,
                reference,
                contractId,
                description: `Platform Fee Deducted for Contract ${contractId}`,
              },
            });
          }

          // Update account balances
          await tx.ledgerAccount.update({
            where: { id: systemEscrow.id },
            data: { balance: { decrement: totalAmount } },
          });

          await tx.ledgerAccount.update({
            where: { id: artisanWallet.id },
            data: { balance: { increment: payoutAmount } },
          });

          if (platformFee > 0) {
            await tx.ledgerAccount.update({
              where: { id: systemFee.id },
              data: { balance: { increment: platformFee } },
            });
          }

          await this.paymentsService.createFinancialEvent(tx, {
            contractId,
            type: FinancialEventType.RELEASE_CONFIRMED,
            amount: transferTx.amount,
            actorId: transferTx.userId,
            metadata: {
              reference,
              transferCode: transferCode || null,
            },
          });
          await this.paymentsService.createAuditLog(tx, {
            action: 'PAYOUT_CONFIRMED',
            contractId,
            actorId: transferTx.userId,
            metadata: {
              reference,
              transferCode: transferCode || null,
            },
          });

          // Mark contract as paid out INSIDE the transaction — ensures atomicity.
          await this.contractsService.markPaidOut(contractId);

          const contract = await tx.contract.findUnique({
            where: { id: contractId },
            include: { job: true },
          });

          if (contract) {
            this.eventEmitter.emit(
              DomainEventName.PAYMENT_PROCESSED,
              new PaymentReleasedEvent(
                transferTx.id,
                contractId,
                contract.jobId,
                contract.job?.title || 'Job',
                contract.artisanId,
                Number(payoutAmount),
              ),
            );
          }
        }
      }
    });

    return { handled: true, event };
  }

  private async handleTransferFailed(payload: any) {
    const event = payload?.event as string;
    const reference = payload?.data?.reference as string | undefined;
    const reason =
      (payload?.data?.reason as string | undefined) ||
      (payload?.data?.status as string | undefined);

    if (!reference) {
      return { handled: false, event };
    }

    const transferTx = await this.prisma.transaction.findFirst({
      where: { reference, type: TransactionType.TRANSFER },
    });

    if (transferTx) {
      const contractId =
        (transferTx.metadata as { contractId?: string } | null)?.contractId ??
        null;

      await this.prisma.transaction.update({
        where: { id: transferTx.id },
        data: {
          status: TransactionStatus.FAILED,
          failedAt: new Date(),
          failureReason: reason || 'Transfer failed',
        },
      });

      if (contractId) {
        await this.contractsService.recordPayoutFailure(contractId, reason);
      }
    }

    return { handled: true, event };
  }

  private async handleRefundProcessed(payload: any) {
    const event = 'refund.processed';
    const transactionReference =
      (payload?.data?.transaction_reference as string | undefined) ||
      (payload?.data?.transaction?.reference as string | undefined);

    if (!transactionReference) {
      return { handled: false, event };
    }

    const payment = await this.prisma.payment.findFirst({
      where: { paymentReference: transactionReference },
      orderBy: { createdAt: 'desc' },
    });

    if (!payment) {
      return { handled: false, event };
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.payment.update({
        where: { id: payment.id },
        data: {
          refundedAt: new Date(),
          metadata: {
            refundProcessed: true,
          },
        },
      });

      const refundTx = await tx.transaction.findFirst({
        where: {
          type: TransactionType.REFUND,
          metadata: {
            path: ['originalReference'],
            equals: transactionReference,
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
      });

      if (refundTx && refundTx.status !== TransactionStatus.COMPLETED) {
        await tx.transaction.update({
          where: { id: refundTx.id },
          data: {
            status: TransactionStatus.COMPLETED,
            completedAt: new Date(),
          },
        });

        // DOUBLE-ENTRY LEDGER: Refund Processed
        const systemEscrow = await tx.ledgerAccount.findFirst({
          where: { type: 'SYSTEM_ESCROW' },
        });
        if (!systemEscrow) {
          throw new NotFoundException('System escrow account not configured.');
        }

        let clientWallet = await tx.ledgerAccount.findUnique({
          where: { userId: payment.userId },
        });
        if (!clientWallet) {
          clientWallet = await tx.ledgerAccount.create({
            data: {
              name: 'Client Wallet',
              type: 'USER_WALLET',
              userId: payment.userId,
            },
          });
        }

        // Create ledger entry
        await tx.ledgerEntry.create({
          data: {
            debitAccountId: systemEscrow.id,
            creditAccountId: clientWallet.id,
            amount: payment.amount,
            reference: transactionReference,
            contractId: payment.contractId,
            paymentId: payment.id,
            description: `Refund processed for Contract ${payment.contractId}`,
          },
        });

        // Update account balances
        await tx.ledgerAccount.update({
          where: { id: systemEscrow.id },
          data: { balance: { decrement: payment.amount } },
        });

        await tx.ledgerAccount.update({
          where: { id: clientWallet.id },
          data: { balance: { increment: payment.amount } },
        });

        await this.paymentsService.createFinancialEvent(tx, {
          contractId: payment.contractId,
          type: FinancialEventType.REFUND_CONFIRMED,
          amount: payment.amount,
          actorId: payment.userId,
          metadata: {
            transactionReference,
            merchantNote:
              (payload?.data?.merchant_note as string | undefined) ?? null,
          },
        });

        await this.paymentsService.createAuditLog(tx, {
          action: 'REFUND_CONFIRMED',
          contractId: payment.contractId,
          actorId: payment.userId,
          metadata: {
            transactionReference,
          },
        });
      }
    });

    await this.contractsService.markRefunded(
      payment.contractId,
      payload?.data?.merchant_note as string | undefined,
    );

    return { handled: true, event };
  }
}
