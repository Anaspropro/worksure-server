import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { TransactionType, TransactionStatus } from '../../generated/prisma';
import { randomUUID } from 'node:crypto';
import { PaystackClientService } from '../../common/services/paystack-client.service';

@Injectable()
export class WalletService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly paystackClient: PaystackClientService,
  ) {}

  // In-memory cache for Paystack dedicated account data
  // Avoids external API calls on every balance check
  private readonly dedicatedAccountCache = new Map<
    string,
    { data: any; expiresAt: number }
  >();
  private readonly CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

  private async getWalletOwner(userId: string) {
    return this.prisma.user.findUnique({
      where: { id: userId },
    });
  }

  private splitName(name: string) {
    const [firstName, ...rest] = name.trim().split(/\s+/);
    return {
      firstName: firstName || 'WorkSure',
      lastName: rest.join(' ') || 'User',
    };
  }

  private mapDedicatedAccount(value: any) {
    if (!value) {
      return null;
    }

    return {
      accountNumber: value.account_number ?? null,
      accountName: value.account_name ?? null,
      bankName: value.bank?.name ?? value.bank_name ?? null,
      status: value.status ?? 'active',
    };
  }

  private async getExistingDedicatedAccount(email: string) {
    if (!this.paystackClient.isConfigured()) {
      return null;
    }

    const data = await this.paystackClient.get<any>(
      `/customer/${encodeURIComponent(email)}`,
      { graceful: true },
    );

    return this.mapDedicatedAccount(data?.dedicated_account);
  }

  private async ensureDedicatedAccount(userId: string) {
    if (!this.paystackClient.isConfigured()) {
      return null;
    }

    const user = await this.getWalletOwner(userId);
    if (!user) {
      return null;
    }

    const existingAccount = await this.getExistingDedicatedAccount(user.email);
    if (existingAccount) {
      return existingAccount;
    }

    const { firstName, lastName } = this.splitName(user.name);

    await this.paystackClient.post(
      '/customer',
      {
        email: user.email,
        first_name: firstName,
        last_name: lastName,
      },
      { graceful: true },
    );

    const assignData = await this.paystackClient.post<any>(
      '/dedicated_account/assign',
      {
        email: user.email,
        first_name: firstName,
        last_name: lastName,
        preferred_bank: 'wema-bank',
        country: 'NG',
      },
      { graceful: true },
    );

    return (
      this.mapDedicatedAccount(assignData?.dedicated_account) ??
      this.mapDedicatedAccount(assignData) ?? {
        accountNumber: null,
        accountName: user.name,
        bankName: 'Paystack',
        status: assignData ? 'provisioning' : 'unavailable',
      }
    );
  }

  private async getCachedVirtualAccount(userId: string) {
    const cached = this.dedicatedAccountCache.get(userId);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.data;
    }
    
    const virtualAccount = await this.ensureDedicatedAccount(userId);
    this.dedicatedAccountCache.set(userId, {
      data: virtualAccount,
      expiresAt: Date.now() + this.CACHE_TTL_MS,
    });
    
    return virtualAccount;
  }

  async ensureWallet(userId: string) {
    const existingWallet = await this.prisma.wallet.findUnique({
      where: { userId },
    });

    if (existingWallet) {
      return existingWallet;
    }

    return this.prisma.wallet.create({
      data: {
        id: randomUUID(),
        userId,
        balance: 0,
        frozen: 0,
        version: 1,
      },
    });
  }

  async getWalletBalance(userId: string) {
    const wallet = await this.prisma.wallet.findUnique({
      where: { userId },
    });

    const virtualAccount = await this.getCachedVirtualAccount(userId);

    return {
      exists: Boolean(wallet),
      balance: wallet?.balance ?? 0,
      frozen: wallet?.frozen ?? 0,
      available: wallet ? wallet.balance - wallet.frozen : 0,
      version: wallet?.version ?? 0,
      virtualAccount,
    };
  }

  async getWalletTransactions(userId: string, limit = 50, offset = 0) {
    const transactions = await this.prisma.transaction.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    const total = await this.prisma.transaction.count({
      where: { userId },
    });

    return {
      transactions,
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + limit < total,
      },
    };
  }

  async createWallet(userId: string) {
    const existingWallet = await this.prisma.wallet.findUnique({
      where: { userId },
    });

    if (existingWallet) {
      return {
        created: false,
        wallet: existingWallet,
        virtualAccount: await this.getCachedVirtualAccount(userId),
      };
    }

    const wallet = await this.prisma.wallet.create({
      data: {
        id: randomUUID(),
        userId,
        balance: 0,
        frozen: 0,
        version: 1,
      },
    });

    return {
      created: true,
      wallet,
      virtualAccount: await this.getCachedVirtualAccount(userId),
    };
  }

  async initiateWalletDeposit(userId: string, amount: number, email: string) {
    if (amount <= 0) throw new BadRequestException('Amount must be positive');

    const reference = `wallet_deposit_${randomUUID()}`;

    const paystackData = await this.paystackClient.call<{
      authorization_url: string;
      access_code: string;
      reference: string;
    }>('/transaction/initialize', {
      method: 'POST',
      body: JSON.stringify({
        amount: amount * 100,
        email,
        reference,
        callback_url: `${process.env.APP_URL}/dashboard`, 
        metadata: {
          type: 'wallet_deposit',
          userId,
        },
      }),
    });

    await this.prisma.transaction.create({
      data: {
        id: randomUUID(),
        userId,
        type: TransactionType.FUNDING,
        amount,
        status: TransactionStatus.PENDING,
        reference: paystackData.reference,
        metadata: {
          action: 'wallet_deposit_init',
          authorizationUrl: paystackData.authorization_url,
          accessCode: paystackData.access_code,
        },
        createdAt: new Date(),
      },
    });

    return {
      authorizationUrl: paystackData.authorization_url,
      reference: paystackData.reference,
    };
  }

  async verifyWalletDeposit(userId: string | null, reference: string) {
    const transaction = await this.prisma.transaction.findFirst({
      where: { reference, type: TransactionType.FUNDING },
    });

    if (!transaction) {
      throw new NotFoundException('Deposit transaction not found');
    }

    if (userId && transaction.userId !== userId) {
      throw new BadRequestException('Unauthorized to verify this deposit');
    }

    const txUserId = transaction.userId;

    if (transaction.status === TransactionStatus.COMPLETED) {
      const wallet = await this.prisma.wallet.findUnique({ where: { userId: txUserId } });
      return { message: 'Deposit already verified', balance: wallet?.balance ?? 0, transaction };
    }

    const paystackData = await this.paystackClient.call<{
      status: string;
      amount: number;
      gateway_response?: string;
    }>(`/transaction/verify/${encodeURIComponent(reference)}`, {
      method: 'GET',
    });

    if (paystackData.status !== 'success') {
      await this.prisma.transaction.update({
        where: { id: transaction.id },
        data: { status: TransactionStatus.FAILED, metadata: { ...(transaction.metadata as any), error: paystackData.gateway_response } },
      });
      throw new BadRequestException(`Payment failed: ${paystackData.gateway_response}`);
    }

    const verifiedAmount = Math.round(paystackData.amount / 100);

    const result = await this.prisma.$transaction(async (tx) => {
      const completedTx = await tx.transaction.update({
        where: { id: transaction.id },
        data: {
          status: TransactionStatus.COMPLETED,
          amount: verifiedAmount,
          completedAt: new Date(),
          metadata: {
            ...(transaction.metadata as any),
            verified: true,
          },
        },
      });

      const wallet = await tx.wallet.findUnique({ where: { userId: txUserId } }) ?? 
        await tx.wallet.create({ data: { id: randomUUID(), userId: txUserId, balance: 0, frozen: 0, version: 1 } });

      const updatedWallet = await tx.wallet.update({
        where: { userId: txUserId, version: wallet.version },
        data: {
          balance: wallet.balance + verifiedAmount,
          version: wallet.version + 1,
        },
      });

      return { wallet: updatedWallet, transaction: completedTx };
    });

    return {
      message: 'Deposit verified successfully',
      balance: result.wallet.balance,
      transaction: result.transaction,
    };
  }

  async requestWalletPayout(
    userId: string,
    amount: number,
    bankCode?: string,
    accountNumber?: string,
  ) {
    if (amount <= 0) {
      throw new BadRequestException('Amount must be positive');
    }

    if (bankCode && accountNumber) {
      await this.prisma.user.update({
        where: { id: userId },
        data: { payoutBankCode: bankCode, payoutAccountNumber: accountNumber },
      });
    }

    const result = await this.prisma.$transaction(async (tx) => {
      const wallet = await tx.wallet.findUnique({ where: { userId } });
      if (!wallet) throw new NotFoundException('Wallet not found');

      const availableBalance = wallet.balance - wallet.frozen;
      if (availableBalance < amount) {
        throw new BadRequestException('Insufficient available balance');
      }

      const updatedWallet = await tx.wallet.update({
        where: { userId, version: wallet.version },
        data: {
          frozen: wallet.frozen + amount,
          version: wallet.version + 1,
        },
      });

      const reference = `payout_req_${randomUUID()}`;
      
      const transaction = await tx.transaction.create({
        data: {
          id: randomUUID(),
          userId,
          type: TransactionType.PAYOUT,
          amount: -amount,
          status: TransactionStatus.PENDING,
          reference,
          metadata: { action: 'wallet_payout_request' },
          createdAt: new Date(),
        },
      });

      return { wallet: updatedWallet, transaction };
    });

    return {
      message: 'Payout request submitted and is pending admin approval',
      transaction: result.transaction,
    };
  }

  async processPayout(adminId: string, transactionId: string) {
    const transaction = await this.prisma.transaction.findUnique({
      where: { id: transactionId },
      include: { user: true }
    });

    if (!transaction || transaction.type !== TransactionType.PAYOUT || transaction.status !== TransactionStatus.PENDING) {
      throw new BadRequestException('Invalid payout request');
    }

    const user = transaction.user;
    if (!user.payoutBankCode || !user.payoutAccountNumber) {
      throw new BadRequestException('User payout profile is incomplete');
    }

    let recipientCode = user.paystackRecipientCode;
    if (!recipientCode) {
      const recipient = await this.paystackClient.post<{ recipient_code: string }>(
        '/transferrecipient',
        {
          type: 'nuban',
          name: user.payoutAccountName || user.name,
          account_number: user.payoutAccountNumber,
          bank_code: user.payoutBankCode,
          currency: 'NGN',
          email: user.email,
        }
      );
      if (recipient) {
        recipientCode = recipient.recipient_code;
        await this.prisma.user.update({
          where: { id: user.id },
          data: { paystackRecipientCode: recipientCode },
        });
      }
    }

    if (!recipientCode) {
      throw new BadRequestException('Failed to create transfer recipient');
    }

    const payoutAmount = Math.abs(transaction.amount);

    const transferData = await this.paystackClient.post<{
      transfer_code: string;
      reference?: string;
      status?: string;
    }>(
      '/transfer',
      {
        source: 'balance',
        amount: payoutAmount * 100,
        recipient: recipientCode,
        reason: 'WorkSure Wallet Withdrawal',
        reference: transaction.reference,
      }
    );

    if (!transferData) {
      throw new BadRequestException('Transfer initiation failed');
    }

    const result = await this.prisma.$transaction(async (tx) => {
      const wallet = await tx.wallet.findUnique({ where: { userId: user.id } });
      if (!wallet) throw new NotFoundException('Wallet not found');

      await tx.wallet.update({
        where: { userId: user.id, version: wallet.version },
        data: {
          balance: wallet.balance - payoutAmount,
          frozen: wallet.frozen - payoutAmount,
          version: wallet.version + 1,
        },
      });

      const updatedTx = await tx.transaction.update({
        where: { id: transaction.id },
        data: {
          status: TransactionStatus.COMPLETED,
          completedAt: new Date(),
          metadata: {
            ...(transaction.metadata as any),
            approvedBy: adminId,
            transferCode: transferData.transfer_code,
          },
        },
      });

      return updatedTx;
    });

    return {
      message: 'Payout processed successfully',
      transaction: result,
    };
  }

  async freezeFunds(
    userId: string,
    amount: number,
    reference: string,
    metadata?: any,
  ) {
    if (amount <= 0) {
      throw new BadRequestException('Amount must be positive');
    }

    const result = await this.prisma.$transaction(async (tx) => {
      const wallet = await tx.wallet.findUnique({
        where: { userId },
      });

      if (!wallet) {
        throw new NotFoundException('Wallet not found');
      }

      const availableBalance = wallet.balance - wallet.frozen;
      if (availableBalance < amount) {
        throw new BadRequestException(
          'Insufficient balance',
        );
      }

      const updatedWallet = await tx.wallet.update({
        where: {
          userId,
          version: wallet.version,
        },
        data: {
          frozen: wallet.frozen + amount,
          version: wallet.version + 1,
        },
      });

      const transaction = await tx.transaction.create({
        data: {
          id: randomUUID(),
          userId,
          type: TransactionType.ESCROW_HOLD,
          amount: -amount,
          status: TransactionStatus.COMPLETED,
          reference,
          metadata: metadata || { action: 'funds_frozen' },
          createdAt: new Date(),
          completedAt: new Date(),
        },
      });

      return {
        wallet: updatedWallet,
        transaction,
      };
    });

    return {
      message: 'Funds frozen successfully',
      balance: result.wallet.balance,
      frozen: result.wallet.frozen,
      available: result.wallet.balance - result.wallet.frozen,
      transaction: result.transaction,
    };
  }

  async unfreezeFunds(
    userId: string,
    amount: number,
    reference: string,
    metadata?: any,
  ) {
    if (amount <= 0) {
      throw new BadRequestException('Amount must be positive');
    }

    const result = await this.prisma.$transaction(async (tx) => {
      const wallet = await tx.wallet.findUnique({
        where: { userId },
      });

      if (!wallet) {
        throw new NotFoundException('Wallet not found');
      }

      if (wallet.frozen < amount) {
        throw new BadRequestException('Insufficient frozen funds to release');
      }

      const updatedWallet = await tx.wallet.update({
        where: {
          userId,
          version: wallet.version,
        },
        data: {
          frozen: wallet.frozen - amount,
          version: wallet.version + 1,
        },
      });

      const transaction = await tx.transaction.create({
        data: {
          id: randomUUID(),
          userId,
          type: TransactionType.ESCROW_RELEASE,
          amount: amount,
          status: TransactionStatus.COMPLETED,
          reference,
          metadata: metadata || { action: 'funds_released' },
          createdAt: new Date(),
          completedAt: new Date(),
        },
      });

      return {
        wallet: updatedWallet,
        transaction,
      };
    });

    return {
      message: 'Funds released successfully',
      balance: result.wallet.balance,
      frozen: result.wallet.frozen,
      available: result.wallet.balance - result.wallet.frozen,
      transaction: result.transaction,
    };
  }

  async releaseEscrowToUser(
    sourceUserId: string,
    destinationUserId: string,
    amount: number,
    reference: string,
    metadata?: any,
  ) {
    if (amount <= 0) {
      throw new BadRequestException('Amount must be positive');
    }

    const result = await this.prisma.$transaction(async (tx) => {
      const sourceWallet = await tx.wallet.findUnique({
        where: { userId: sourceUserId },
      });

      if (!sourceWallet) {
        throw new NotFoundException('Source wallet not found');
      }

      if (sourceWallet.frozen < amount) {
        throw new BadRequestException('Insufficient frozen funds to release');
      }

      let destinationWallet = await tx.wallet.findUnique({
        where: { userId: destinationUserId },
      });

      if (!destinationWallet) {
        destinationWallet = await tx.wallet.create({
          data: {
            id: randomUUID(),
            userId: destinationUserId,
            balance: 0,
            frozen: 0,
            version: 1,
          },
        });
      }

      const updatedSourceWallet = await tx.wallet.update({
        where: {
          userId: sourceUserId,
          version: sourceWallet.version,
        },
        data: {
          balance: sourceWallet.balance - amount,
          frozen: sourceWallet.frozen - amount,
          version: sourceWallet.version + 1,
        },
      });

      const updatedDestinationWallet = await tx.wallet.update({
        where: {
          userId: destinationUserId,
          version: destinationWallet.version,
        },
        data: {
          balance: destinationWallet.balance + amount,
          version: destinationWallet.version + 1,
        },
      });

      const transaction = await tx.transaction.create({
        data: {
          id: randomUUID(),
          userId: destinationUserId,
          type: TransactionType.ESCROW_RELEASE,
          amount,
          status: TransactionStatus.COMPLETED,
          reference,
          metadata: metadata || { action: 'escrow_release' },
          createdAt: new Date(),
          completedAt: new Date(),
        },
      });

      return {
        sourceWallet: updatedSourceWallet,
        destinationWallet: updatedDestinationWallet,
        transaction,
      };
    });

    return {
      message: 'Escrow released successfully',
      source: {
        balance: result.sourceWallet.balance,
        frozen: result.sourceWallet.frozen,
        available: result.sourceWallet.balance - result.sourceWallet.frozen,
      },
      destination: {
        balance: result.destinationWallet.balance,
        frozen: result.destinationWallet.frozen,
        available:
          result.destinationWallet.balance - result.destinationWallet.frozen,
      },
      transaction: result.transaction,
    };
  }

  async chargePlatformFee(
    userId: string,
    amount: number,
    reference: string,
    metadata?: any,
  ) {
    if (amount <= 0) {
      throw new BadRequestException('Amount must be positive');
    }

    const result = await this.prisma.$transaction(async (tx) => {
      const wallet = await tx.wallet.findUnique({
        where: { userId },
      });

      if (!wallet) {
        throw new NotFoundException('Wallet not found');
      }

      const availableBalance = wallet.balance - wallet.frozen;
      if (availableBalance < amount) {
        throw new BadRequestException('Insufficient available balance');
      }

      const updatedWallet = await tx.wallet.update({
        where: {
          userId,
          version: wallet.version,
        },
        data: {
          balance: wallet.balance - amount,
          version: wallet.version + 1,
        },
      });

      const transaction = await tx.transaction.create({
        data: {
          id: randomUUID(),
          userId,
          type: TransactionType.PLATFORM_FEE,
          amount,
          status: TransactionStatus.COMPLETED,
          reference,
          metadata: metadata || { action: 'platform_fee' },
          createdAt: new Date(),
          completedAt: new Date(),
        },
      });

      return {
        wallet: updatedWallet,
        transaction,
      };
    });

    return {
      message: 'Platform fee charged successfully',
      balance: result.wallet.balance,
      transaction: result.transaction,
    };
  }

  async getTransaction(userId: string, transactionId: string) {
    const transaction = await this.prisma.transaction.findUnique({
      where: { id: transactionId },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    if (!transaction) {
      throw new NotFoundException('Transaction not found');
    }

    if (transaction.userId !== userId) {
      throw new ForbiddenException('Access denied to this transaction');
    }

    return transaction;
  }

  async getWalletSummary(userId: string) {
    const wallet = await this.prisma.wallet.findUnique({
      where: { userId },
    });
    const virtualAccount = await this.getCachedVirtualAccount(userId);

    const transactions = await this.prisma.transaction.groupBy({
      by: ['type', 'status'],
      where: { userId },
      _sum: {
        amount: true,
      },
      _count: {
        id: true,
      },
    });

    const recentTransactions = await this.prisma.transaction.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 5,
    });

    return {
      wallet: {
        exists: Boolean(wallet),
        balance: wallet?.balance ?? 0,
        frozen: wallet?.frozen ?? 0,
        available: wallet ? wallet.balance - wallet.frozen : 0,
        version: wallet?.version ?? 0,
        virtualAccount,
      },
      transactionSummary: transactions,
      recentTransactions,
    };
  }
}
