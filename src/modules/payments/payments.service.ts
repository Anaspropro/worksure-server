import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../../database/prisma.service';
import {
  ContractStatus,
  PaymentStatus,
  TransactionStatus,
  TransactionType,
} from '../../generated/prisma';
import { ContractsService } from '../contracts/contracts.service';

@Injectable()
export class PaymentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly contractsService: ContractsService,
  ) {}

  private getPaystackSecretKey(): string {
    const key = process.env.PAYSTACK_SECRET_KEY;
    if (!key) {
      throw new Error(
        'PAYSTACK_SECRET_KEY is required in environment variables',
      );
    }

    return key;
  }

  private getPaystackHeaders(extraHeaders?: Record<string, string>) {
    return {
      Authorization: `Bearer ${this.getPaystackSecretKey()}`,
      'Content-Type': 'application/json',
      ...extraHeaders,
    };
  }

  private getPlatformFeePercent() {
    const raw = Number(process.env.PLATFORM_FEE_PERCENT ?? 10);
    return Number.isFinite(raw) && raw >= 0 ? raw : 10;
  }

  private getPaystackBaseUrl() {
    return 'https://api.paystack.co';
  }

  private async callPaystack<T>(
    path: string,
    init: RequestInit,
    extraHeaders?: Record<string, string>,
  ): Promise<T> {
    const response = await fetch(`${this.getPaystackBaseUrl()}${path}`, {
      ...init,
      headers: this.getPaystackHeaders(extraHeaders),
    });

    const payload = (await response.json().catch(() => null)) as {
      status?: boolean;
      message?: string;
      data?: T;
    } | null;

    if (!response.ok || !payload?.status) {
      throw new BadRequestException(
        payload?.message || 'Paystack request failed',
      );
    }

    return payload.data as T;
  }

  private buildTransferReference(contractId: string) {
    return `ws_transfer_${contractId}_${Date.now()}`;
  }

  private buildRefundReference(contractId: string) {
    return `ws_refund_${contractId}_${Date.now()}`;
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

    const payment = await this.prisma.payment.create({
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

    const paystackData = await this.callPaystack<{
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

    const paystackData = await this.callPaystack<{
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
          systemEscrow = await tx.ledgerAccount.create({
            data: { name: 'WorkSure Escrow', type: 'SYSTEM_ESCROW' },
          });
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
    return this.contractsService.confirmCompletion(
      contractId,
      userId,
      isClient,
    );
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

    const recipient = await this.callPaystack<{ recipient_code: string }>(
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
    const transferData = await this.callPaystack<{
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
      await tx.transaction.create({
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
            transferCode: transferData.transfer_code,
            platformFee,
          },
          createdAt: new Date(),
        },
      });

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

    await this.contractsService.markPayoutInitiated(contract.id);

    return {
      message: 'Payout initiated successfully',
      reference,
      recipientCode,
      transferCode: transferData.transfer_code,
      payoutAmount,
      platformFee,
    };
  }

  async releaseEscrow(contractId: string, userId: string) {
    const contract = await this.contractsService.assertReadyForPayout(
      contractId,
      userId,
    );

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

  async refundContract(contractId: string, userId: string, reason?: string) {
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

    if (contract.clientId !== userId) {
      throw new ForbiddenException('Only the client can request a refund');
    }

    const payment = contract.payments.find((entry) => entry.isVerified);
    if (!payment?.paymentReference) {
      throw new BadRequestException(
        'No successful Paystack payment was found for this contract',
      );
    }

    await this.contractsService.refundContract(contractId, userId, reason);

    const reference = this.buildRefundReference(contractId);
    await this.callPaystack<{
      status?: string;
    }>('/refund', {
      method: 'POST',
      body: JSON.stringify({
        transaction: payment.paymentReference,
        amount: contract.amount * 100,
        merchant_note: reason || `Refund for contract ${contractId}`,
      }),
    });

    await this.prisma.transaction.create({
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
              await this.contractsService.markPaidOut(contractId);
            }
          }
        });

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
    const limit = query.limit ?? 10;
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
