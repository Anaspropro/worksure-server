import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../../database/prisma.service';
import {
  AuditEntityType,
  ContractStatus,
  FinancialEventType,
  PaymentStatus,
  Prisma,
  TransactionStatus,
  TransactionType,
} from '../../generated/prisma';
import { ContractsService } from '../contracts/contracts.service';
import { PaystackClientService } from '../../common/services/paystack-client.service';
import { IdempotencyService } from '../../common/services/idempotency.service';

@Injectable()
export class PaymentsService {
  private readonly payoutNamespace = 'payout';
  private readonly refundNamespace = 'refund';

  constructor(
    private readonly prisma: PrismaService,
    private readonly contractsService: ContractsService,
    private readonly paystackClient: PaystackClientService,
    private readonly idempotency: IdempotencyService,
  ) {}

  private buildTransferReference(contractId: string) {
    return `ws_transfer_${contractId}_${Date.now()}`;
  }

  private buildRefundReference(contractId: string) {
    return `ws_refund_${contractId}_${Date.now()}`;
  }

  private getPlatformFeePercent() {
    const raw = Number(process.env.PLATFORM_FEE_PERCENT ?? 10);
    return Number.isFinite(raw) && raw >= 0 ? raw : 10;
  }

  private async createFinancialEvent(
    prismaClient: Prisma.TransactionClient | PrismaService,
    input: {
      contractId: string;
      type: FinancialEventType;
      amount: number;
      actorId?: string | null;
      metadata?: Prisma.InputJsonValue;
    },
  ) {
    return prismaClient.financialEvent.create({
      data: {
        id: randomUUID(),
        contractId: input.contractId,
        type: input.type,
        amount: input.amount,
        actorId: input.actorId ?? null,
        metadata: input.metadata,
      },
    });
  }

  private async createAuditLog(
    prismaClient: Prisma.TransactionClient | PrismaService,
    input: {
      action: string;
      contractId: string;
      actorId?: string | null;
      metadata?: Prisma.InputJsonValue;
    },
  ) {
    return prismaClient.auditLog.create({
      data: {
        id: randomUUID(),
        action: input.action,
        entityType: AuditEntityType.CONTRACT,
        entityId: input.contractId,
        performedBy: input.actorId ?? 'system',
        performedAt: new Date(),
        metadata: input.metadata,
      },
    });
  }

  async initializeContractPayment(
    userId: string,
    contractId: string,
    email: string,
    callbackUrl?: string,
  ) {
    const contract = await this.prisma.contract.findUnique({
      where: { id: contractId },
    });

    if (!contract) {
      throw new NotFoundException('Contract not found');
    }

    if (contract.clientId !== userId) {
      throw new ForbiddenException('Only the client can fund the contract');
    }

    const fundableStatuses = new Set<ContractStatus>([
      ContractStatus.PENDING_PAYMENT,
      ContractStatus.DRAFT,
    ]);

    if (!fundableStatuses.has(contract.status)) {
      throw new BadRequestException(
        'Contract is not eligible for a new payment initialization',
      );
    }

    const payment = await this.prisma.$transaction(async (tx) => {
      const createdPayment = await tx.payment.create({
        data: {
          id: randomUUID(),
          contractId,
          userId,
          amount: contract.amount,
          currency: contract.currency,
          gateway: 'PAYSTACK',
          status: PaymentStatus.PENDING,
          paymentMethod: 'PAYSTACK',
          isVerified: false,
          metadata: {
            stage: 'initialization_requested',
          },
        },
      });

      await this.createFinancialEvent(tx, {
        contractId,
        type: FinancialEventType.FUND_REQUESTED,
        amount: contract.amount,
        actorId: userId,
        metadata: {
          email,
          callbackUrl: callbackUrl ?? null,
        },
      });

      await this.createAuditLog(tx, {
        action: 'PAYMENT_FUND_REQUESTED',
        contractId,
        actorId: userId,
        metadata: {
          paymentId: createdPayment.id,
        },
      });

      return createdPayment;
    });

    const paystackData = await this.paystackClient.call<{
      authorization_url: string;
      access_code: string;
      reference: string;
    }>('/transaction/initialize', {
      method: 'POST',
      body: JSON.stringify({
        amount: contract.amount * 100,
        email,
        callback_url:
          callbackUrl || `${process.env.APP_URL}/contracts/${contractId}`,
        metadata: {
          contractId,
          userId,
          paymentId: payment.id,
          gateway: 'paystack',
        },
      }),
    });

    const updatedPayment = await this.prisma.payment.update({
      where: { id: payment.id },
      data: {
        paymentReference: paystackData.reference,
        paystackAccessCode: paystackData.access_code,
        paystackAuthorizationUrl: paystackData.authorization_url,
        metadata: {
          stage: 'initialized',
        },
      },
    });

    await this.contractsService.markPaymentInitializationRequested(
      contractId,
      paystackData.reference,
      paystackData.authorization_url,
      paystackData.access_code,
    );

    return {
      payment: updatedPayment,
      authorizationUrl: paystackData.authorization_url,
      accessCode: paystackData.access_code,
      reference: paystackData.reference,
    };
  }

  async verifyPaystackPayment(reference: string, userId?: string) {
    if (!reference) {
      throw new BadRequestException(
        'Reference is required for Paystack verification',
      );
    }

    const payment = await this.prisma.payment.findFirst({
      where: { paymentReference: reference },
      include: {
        contract: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    if (!payment) {
      throw new NotFoundException('Payment record not found for reference');
    }

    if (userId && payment.userId !== userId) {
      throw new ForbiddenException(
        'You are not authorized to verify this payment',
      );
    }

    if (payment.isVerified && payment.status === PaymentStatus.COMPLETED) {
      return {
        message: 'Payment already processed',
        payment,
      };
    }

    const paystackData = await this.paystackClient.call<{
      id: number;
      status: string;
      amount: number;
      reference: string;
      gateway_response?: string;
      metadata?: {
        contractId?: string;
      };
    }>(`/transaction/verify/${encodeURIComponent(reference)}`, {
      method: 'GET',
    });

    if (paystackData.status !== 'success') {
      throw new BadRequestException('Paystack transaction is not successful');
    }

    const contractId = paystackData.metadata?.contractId || payment.contractId;

    const updatedPayment = await this.prisma.$transaction(async (tx) => {
      const rawLocks = await tx.$queryRaw<
        { id: string }[]
      >`SELECT id FROM "Payment" WHERE "id" = ${payment.id} FOR UPDATE`;
      if (!rawLocks || rawLocks.length === 0) {
        throw new NotFoundException('Payment record locked or not found');
      }

      const lockedPayment = await tx.payment.findUnique({
        where: { id: payment.id },
      });
      if (lockedPayment?.isVerified) {
        return lockedPayment; // Handled concurrently
      }

      const completedPayment = await tx.payment.update({
        where: { id: payment.id },
        data: {
          status: PaymentStatus.COMPLETED,
          isVerified: true,
          verifiedAt: new Date(),
          completedAt: new Date(),
          paystackTransactionId: String(paystackData.id),
          metadata: {
            gatewayResponse: paystackData.gateway_response ?? null,
            verifiedReference: paystackData.reference,
          },
        },
      });

      const existingTx = await tx.transaction.findFirst({
        where: {
          reference: paystackData.reference,
          type: TransactionType.PAYMENT,
        },
      });

      if (!existingTx) {
        await tx.transaction.create({
          data: {
            id: randomUUID(),
            userId: payment.userId,
            type: TransactionType.PAYMENT,
            amount: Math.round(paystackData.amount / 100),
            status: TransactionStatus.COMPLETED,
            reference: paystackData.reference,
            metadata: {
              contractId,
              gateway: 'paystack',
            },
            createdAt: new Date(),
            completedAt: new Date(),
          },
        });

        // DOUBLE-ENTRY LEDGER: Client Funding
        let userWallet = await tx.ledgerAccount.findUnique({
          where: { userId: payment.userId },
        });
        if (!userWallet) {
          userWallet = await tx.ledgerAccount.create({
            data: {
              name: 'Client Wallet',
              type: 'USER_WALLET',
              userId: payment.userId,
            },
          });
        }

        let systemEscrow = await tx.ledgerAccount.findFirst({
          where: { type: 'SYSTEM_ESCROW' },
        });
        if (!systemEscrow) {
          throw new NotFoundException('System escrow account not configured. Please run seeds.');
        }

        await tx.ledgerEntry.create({
          data: {
            debitAccountId: userWallet.id,
            creditAccountId: systemEscrow.id,
            amount: Math.round(paystackData.amount / 100),
            reference: paystackData.reference,
            contractId,
            paymentId: payment.id,
            description: `Payment Funded Escrow for Contract ${contractId}`,
          },
        });

        await tx.ledgerAccount.update({
          where: { id: userWallet.id },
          data: { balance: { decrement: Math.round(paystackData.amount / 100) } }
        });

        await tx.ledgerAccount.update({
          where: { id: systemEscrow.id },
          data: { balance: { increment: Math.round(paystackData.amount / 100) } }
        });

        await this.createFinancialEvent(tx, {
          contractId,
          type: FinancialEventType.FUND_CONFIRMED,
          amount: Math.round(paystackData.amount / 100),
          actorId: payment.userId,
          metadata: {
            paymentId: payment.id,
            reference: paystackData.reference,
            paystackTransactionId: String(paystackData.id),
          },
        });

        await this.createAuditLog(tx, {
          action: 'PAYMENT_FUND_CONFIRMED',
          contractId,
          actorId: payment.userId,
          metadata: {
            paymentId: payment.id,
            reference: paystackData.reference,
          },
        });
      }

      return completedPayment;
    });

    await this.contractsService.markFunded(
      contractId,
      updatedPayment.id,
      paystackData.reference,
      payment.paystackAuthorizationUrl,
      payment.paystackAccessCode,
    );

    return {
      message: 'Paystack payment verified successfully',
      payment: updatedPayment,
    };
  }

  async verifyPayment(
    userId: string,
    paymentId: string,
    verificationCode: string,
  ) {
    const payment = await this.prisma.payment.findUnique({
      where: { id: paymentId },
    });

    if (!payment) {
      throw new NotFoundException('Payment not found');
    }

    if (payment.userId !== userId) {
      throw new ForbiddenException(
        'You are not authorized to verify this payment',
      );
    }

    if (payment.verificationCode !== verificationCode) {
      throw new BadRequestException('Invalid verification code');
    }

    if (payment.isVerified) {
      return payment;
    }

    return this.prisma.payment.update({
      where: { id: paymentId },
      data: {
        isVerified: true,
        status: PaymentStatus.COMPLETED,
        verifiedAt: new Date(),
        completedAt: new Date(),
      },
    });
  }

  async activateContract(contractId: string, userId: string) {
    return this.contractsService.activateContract(contractId, userId);
  }

  async completeContract(
    contractId: string,
    userId: string,
    isClient: boolean,
  ) {
    const updatedContract = await this.contractsService.confirmCompletion(
      contractId,
      userId,
      isClient,
    );

    if (updatedContract.status === ContractStatus.READY_FOR_PAYOUT) {
      try {
        await this.releaseEscrow(contractId);
      } catch (error) {
        import('@nestjs/common').then(({ Logger }) => {
          Logger.error(
            `Automatic escrow release failed for contract ${contractId}: ${error instanceof Error ? error.message : String(error)}`,
            error instanceof Error ? error.stack : undefined,
            'PaymentsService'
          );
        });
        throw new BadRequestException('Contract completed, but automatic payout failed. Admin has been notified.');
      }
    }

    return updatedContract;
  }

  private async ensureTransferRecipient(artisanId: string) {
    const artisan = await this.prisma.user.findUnique({
      where: { id: artisanId },
      select: {
        name: true,
        email: true,
        paystackRecipientCode: true,
        payoutBankCode: true,
        payoutAccountNumber: true,
        payoutAccountName: true,
      },
    });

    if (!artisan) {
      throw new NotFoundException('Artisan not found');
    }

    if (artisan.paystackRecipientCode) {
      return artisan.paystackRecipientCode;
    }

    if (!artisan.payoutBankCode || !artisan.payoutAccountNumber) {
      throw new BadRequestException(
        'Artisan payout profile is incomplete. Add bank code and account number before payout.',
      );
    }

    const recipient = await this.paystackClient.call<{ recipient_code: string }>(
      '/transferrecipient',
      {
        method: 'POST',
        body: JSON.stringify({
          type: 'nuban',
          name: artisan.payoutAccountName || artisan.name,
          account_number: artisan.payoutAccountNumber,
          bank_code: artisan.payoutBankCode,
          currency: 'NGN',
          email: artisan.email,
        }),
      },
    );

    await this.prisma.user.update({
      where: { id: artisanId },
      data: {
        paystackRecipientCode: recipient.recipient_code,
      },
    });

    return recipient.recipient_code;
  }

  private async initiatePayout(contract: {
    id: string;
    amount: number;
    artisanId: string;
  }) {
    const lockKey = `contract:${contract.id}:release`;
    const acquired = await this.idempotency.tryAcquire(
      lockKey,
      this.payoutNamespace,
    );
    if (!acquired) {
      throw new BadRequestException(
        'Payout is already in progress for this contract',
      );
    }

    const recipientCode = await this.ensureTransferRecipient(
      contract.artisanId,
    );
    const platformFee = Math.floor(
      (contract.amount * this.getPlatformFeePercent()) / 100,
    );
    const payoutAmount = contract.amount - platformFee;

    if (payoutAmount <= 0) {
      throw new BadRequestException('Calculated payout amount is invalid');
    }

    const reference = this.buildTransferReference(contract.id);
    let dbTxId: string | undefined = undefined;
    try {
      await this.prisma.$transaction(async (tx) => {
        const tr = await tx.transaction.create({
          data: {
            id: randomUUID(),
            userId: contract.artisanId,
            type: TransactionType.TRANSFER,
            amount: payoutAmount,
            status: TransactionStatus.PENDING,
            reference,
            metadata: {
              contractId: contract.id,
              recipientCode,
              platformFee,
            },
            createdAt: new Date(),
          },
        });
        dbTxId = tr.id;

        await this.createFinancialEvent(tx, {
          contractId: contract.id,
          type: FinancialEventType.RELEASE_REQUESTED,
          amount: payoutAmount,
          actorId: contract.artisanId,
          metadata: {
            reference,
            recipientCode,
            platformFee,
          },
        });

        await this.createAuditLog(tx, {
          action: 'PAYOUT_REQUESTED',
          contractId: contract.id,
          actorId: contract.artisanId,
          metadata: {
            reference,
            recipientCode,
          },
        });
      });

      const transferData = await this.paystackClient.call<{
        transfer_code: string;
        reference?: string;
        status?: string;
      }>(
        '/transfer',
        {
          method: 'POST',
          body: JSON.stringify({
            source: 'balance',
            amount: payoutAmount * 100,
            recipient: recipientCode,
            reason: `WorkSure payout for contract ${contract.id}`,
            reference,
          }),
        },
        {
          'X-Idempotency-Key': reference,
        },
      );

      await this.prisma.$transaction(async (tx) => {
        const payment = await tx.payment.findFirst({
          where: {
            contractId: contract.id,
            isVerified: true,
          },
          orderBy: {
            createdAt: 'desc',
          },
        });

        if (payment) {
          await tx.payment.update({
            where: { id: payment.id },
            data: {
              recipientCode,
              transferCode: transferData.transfer_code,
            },
          });
        }
      });

      await this.idempotency.complete(lockKey, this.payoutNamespace);
      await this.contractsService.markPayoutInitiated(contract.id);

      return {
        message: 'Payout initiated successfully',
        reference,
        recipientCode,
        transferCode: transferData.transfer_code,
        payoutAmount,
        platformFee,
      };
    } catch (error) {
      if (dbTxId) {
        await this.prisma.transaction.update({
          where: { id: dbTxId },
          data: { status: TransactionStatus.FAILED }
        });
      }
      await this.idempotency.release(lockKey, this.payoutNamespace);
      throw error;
    }
  }

  async releaseEscrow(contractId: string) {
    const contract =
      await this.contractsService.assertReadyForPayout(contractId);

    return this.initiatePayout(contract);
  }

  async releaseEscrowByAdmin(contractId: string, reason?: string) {
    const contract = await this.prisma.contract.findUnique({
      where: { id: contractId },
      include: {
        artisan: {
          select: {
            artisanVerified: true,
          },
        },
      },
    });

    if (!contract) {
      throw new NotFoundException('Contract not found');
    }

    const adminPayoutStatuses = new Set<ContractStatus>([
      ContractStatus.FUNDED,
      ContractStatus.IN_PROGRESS,
      ContractStatus.CLIENT_CONFIRMED,
      ContractStatus.READY_FOR_PAYOUT,
      ContractStatus.DISPUTED,
    ]);

    if (!adminPayoutStatuses.has(contract.status)) {
      throw new BadRequestException(
        'Contract is not in a state that can be settled by admin payout',
      );
    }

    if (!contract.artisan.artisanVerified) {
      throw new BadRequestException(
        'Artisan verification is required before payout.',
      );
    }

    const result = await this.initiatePayout(contract);

    if (reason) {
      await this.prisma.transaction.updateMany({
        where: {
          reference: result.reference,
          type: TransactionType.TRANSFER,
        },
        data: {
          metadata: {
            contractId: contract.id,
            adminReason: reason,
            settlementMode: 'admin_dispute_resolution',
          },
        },
      });
    }
  }

  async refundContract(
    contractId: string,
    userId: string,
    isAdmin: boolean,
    reason?: string,
  ) {
    const contract = await this.prisma.contract.findUnique({
      where: { id: contractId },
      include: {
        payments: {
          orderBy: {
            createdAt: 'desc',
          },
        },
      },
    });

    if (!contract) {
      throw new NotFoundException('Contract not found');
    }

    if (!isAdmin && contract.clientId !== userId) {
      throw new ForbiddenException('Only the client can request a refund');
    }

    if (!isAdmin) {
      const noRefundStatuses = new Set<ContractStatus>([
        ContractStatus.IN_PROGRESS,
        ContractStatus.CLIENT_CONFIRMED,
        ContractStatus.READY_FOR_PAYOUT,
        ContractStatus.COMPLETED,
        ContractStatus.DISPUTED,
      ]);
      if (noRefundStatuses.has(contract.status)) {
        throw new ForbiddenException(
          'Client can only request a refund before work starts. Please open a dispute instead.',
        );
      }
    }

    const payment = contract.payments.find((entry) => entry.isVerified);
    if (!payment?.paymentReference) {
      throw new BadRequestException(
        'No successful Paystack payment was found for this contract',
      );
    }

    const reference = this.buildRefundReference(contractId);
    const lockKey = `contract:${contractId}:refund`;
    const acquired = await this.idempotency.tryAcquire(
      lockKey,
      this.refundNamespace,
    );
    if (!acquired) {
      throw new BadRequestException(
        'Refund is already in progress for this contract',
      );
    }

    let dbTxId: string | undefined = undefined;
    try {
      await this.prisma.$transaction(async (tx) => {
        const tr = await tx.transaction.create({
          data: {
            id: randomUUID(),
            userId: contract.clientId,
            type: TransactionType.REFUND,
            amount: contract.amount,
            status: TransactionStatus.PENDING,
            reference,
            metadata: {
              contractId,
              originalReference: payment.paymentReference,
              reason: reason || null,
            },
            createdAt: new Date(),
          },
        });
        dbTxId = tr.id;

        await this.createFinancialEvent(tx, {
          contractId,
          type: FinancialEventType.REFUND_REQUESTED,
          amount: contract.amount,
          actorId: userId,
          metadata: {
            reference,
            originalReference: payment.paymentReference,
            reason: reason || null,
            isAdmin,
          },
        });

        await this.createAuditLog(tx, {
          action: 'REFUND_REQUESTED',
          contractId,
          actorId: userId,
          metadata: {
            reference,
            originalReference: payment.paymentReference,
            reason: reason || null,
          },
        });
      });

      await this.paystackClient.call<{
        status?: string;
      }>('/refund', {
        method: 'POST',
        body: JSON.stringify({
          transaction: payment.paymentReference,
          amount: contract.amount * 100,
          merchant_note: reason || `Refund for contract ${contractId}`,
        }),
      });

      await this.contractsService.refundContract(
        contractId,
        userId,
        isAdmin,
        reason,
      );

      await this.idempotency.complete(lockKey, this.refundNamespace);
    } catch (error) {
      if (dbTxId) {
        await this.prisma.transaction.update({
          where: { id: dbTxId },
          data: { status: TransactionStatus.FAILED }
        });
      }
      await this.idempotency.release(lockKey, this.refundNamespace);
      throw error;
    }

    return {
      message: 'Refund requested successfully',
      reference,
    };
  }
  // Duplicate releaseEscrow/releaseEscrowByAdmin implementations removed.
  // The earlier implementations (above) are used.

  async processPaystackWebhook(payload: any) {
    const event = payload?.event as string | undefined;

    if (!event) {
      throw new BadRequestException('Webhook event is required');
    }

    switch (event) {
      case 'charge.success': {
        const reference = payload?.data?.reference as string | undefined;
        if (reference) {
          await this.verifyPaystackPayment(reference);
        }
        return { handled: true, event };
      }

      case 'transfer.success': {
        const reference = payload?.data?.reference as string | undefined;
        const transferCode = payload?.data?.transfer_code as string | undefined;
        if (!reference) {
          return { handled: false, event };
        }

        let paidOutContractId: string | null = null;

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
              (transferTx.metadata as { contractId?: string } | null)
                ?.contractId ?? null;

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
              paidOutContractId = contractId;

              // DOUBLE-ENTRY LEDGER: Payout Release
              const metadata = transferTx.metadata as { contractId?: string; platformFee?: number } | null;
              const platformFee = metadata?.platformFee ?? 0;
              const payoutAmount = transferTx.amount;
              const totalAmount = payoutAmount + platformFee;

              let systemEscrow = await tx.ledgerAccount.findFirst({
                where: { type: 'SYSTEM_ESCROW' },
              });
              if (!systemEscrow) {
                throw new NotFoundException('System escrow account not configured.');
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

              await this.createFinancialEvent(tx, {
                contractId,
                type: FinancialEventType.RELEASE_CONFIRMED,
                amount: transferTx.amount,
                actorId: transferTx.userId,
                metadata: {
                  reference,
                  transferCode: transferCode || null,
                },
              });
              await this.createAuditLog(tx, {
                action: 'PAYOUT_CONFIRMED',
                contractId,
                actorId: transferTx.userId,
                metadata: {
                  reference,
                  transferCode: transferCode || null,
                },
              });
            }
          }
        });

        if (paidOutContractId) {
          await this.contractsService.markPaidOut(paidOutContractId);
        }

        return { handled: true, event };
      }

      case 'transfer.failed':
      case 'transfer.reversed': {
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
            (transferTx.metadata as { contractId?: string } | null)
              ?.contractId ?? null;

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

      case 'refund.processed': {
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
            let systemEscrow = await tx.ledgerAccount.findFirst({
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

            await this.createFinancialEvent(tx, {
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

            await this.createAuditLog(tx, {
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

      default:
        return { handled: false, event };
    }
  }

  async listPayments(
    userId: string,
    query: {
      contractId?: string;
      status?: string;
      dateFrom?: string;
      dateTo?: string;
      page?: number;
      limit?: number;
    },
  ) {
    const page = query.page ?? 1;
    const limit = Math.min(query.limit ?? 10, 100);
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = {
      OR: [
        { userId },
        {
          contract: {
            artisanId: userId,
          },
        },
      ],
    };

    if (query.contractId) {
      where.contractId = query.contractId;
    }

    if (query.status) {
      where.status = query.status;
    }

    if (query.dateFrom || query.dateTo) {
      where.createdAt = {
        gte: query.dateFrom ? new Date(query.dateFrom) : undefined,
        lte: query.dateTo ? new Date(query.dateTo) : undefined,
      };
    }

    const [items, total] = await Promise.all([
      this.prisma.payment.findMany({
        where,
        include: {
          contract: true,
        },
        orderBy: {
          createdAt: 'desc',
        },
        skip,
        take: limit,
      }),
      this.prisma.payment.count({ where }),
    ]);

    return {
      data: items,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasNext: skip + limit < total,
        hasPrev: page > 1,
      },
    };
  }
  // Duplicate webhook handlers removed — unified handler above is used.
}
