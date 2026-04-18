import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { TransactionType, TransactionStatus } from '../../generated/prisma';
import { randomUUID } from 'node:crypto';

@Injectable()
export class WalletService {
  constructor(private readonly prisma: PrismaService) {}

  private getPaystackSecretKey() {
    return process.env.PAYSTACK_SECRET_KEY ?? null;
  }

  private getPaystackHeaders() {
    const secretKey = this.getPaystackSecretKey();
    if (!secretKey) {
      return null;
    }

    return {
      Authorization: `Bearer ${secretKey}`,
      'Content-Type': 'application/json',
    };
  }

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
    const headers = this.getPaystackHeaders();
    if (!headers) {
      return null;
    }

    const response = await fetch(
      `https://api.paystack.co/customer/${encodeURIComponent(email)}`,
      {
        method: 'GET',
        headers,
      },
    );

    if (!response.ok) {
      return null;
    }

    const payload = await response.json();
    return this.mapDedicatedAccount(payload?.data?.dedicated_account);
  }

  private async ensureDedicatedAccount(userId: string) {
    const headers = this.getPaystackHeaders();
    if (!headers) {
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

    await fetch('https://api.paystack.co/customer', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        email: user.email,
        first_name: firstName,
        last_name: lastName,
      }),
    }).catch(() => null);

    const assignResponse = await fetch(
      'https://api.paystack.co/dedicated_account/assign',
      {
        method: 'POST',
        headers,
        body: JSON.stringify({
          email: user.email,
          first_name: firstName,
          last_name: lastName,
          preferred_bank: 'wema-bank',
          country: 'NG',
        }),
      },
    );

    const assignPayload = await assignResponse.json().catch(() => null);

    return (
      this.mapDedicatedAccount(assignPayload?.data?.dedicated_account) ??
      this.mapDedicatedAccount(assignPayload?.data) ??
      {
        accountNumber: null,
        accountName: user.name,
        bankName: 'Paystack',
        status: assignResponse.ok ? 'provisioning' : 'unavailable',
      }
    );
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
    const virtualAccount = await this.ensureDedicatedAccount(userId);

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
        virtualAccount: await this.ensureDedicatedAccount(userId),
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
      virtualAccount: await this.ensureDedicatedAccount(userId),
    };
  }

  async addFunds(
    userId: string,
    amount: number,
    reference?: string,
    metadata?: any,
  ) {
    if (amount <= 0) {
      throw new BadRequestException('Amount must be positive');
    }

    const result = await this.prisma.$transaction(async (tx) => {
      const wallet =
        (await tx.wallet.findUnique({
          where: { userId },
        })) ??
        (await tx.wallet.create({
          data: {
            id: randomUUID(),
            userId,
            balance: 0,
            frozen: 0,
            version: 1,
          },
        }));

      const updatedWallet = await tx.wallet.update({
        where: {
          userId,
          version: wallet.version,
        },
        data: {
          balance: wallet.balance + amount,
          version: wallet.version + 1,
        },
      });

      const transaction = await tx.transaction.create({
        data: {
          id: randomUUID(),
          userId,
          type: TransactionType.FUNDING,
          amount,
          status: TransactionStatus.COMPLETED,
          reference: reference || `wallet_fund_${Date.now()}`,
          metadata: metadata || { action: 'wallet_funding' },
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
      message: 'Funds added successfully',
      balance: result.wallet.balance,
      transaction: result.transaction,
    };
  }

  async withdrawFunds(
    userId: string,
    amount: number,
    reference?: string,
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
          type: TransactionType.PAYOUT,
          amount: -amount,
          status: TransactionStatus.COMPLETED,
          reference: reference || `wallet_withdraw_${Date.now()}`,
          metadata: metadata || { action: 'wallet_withdrawal' },
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
      message: 'Funds withdrawn successfully',
      balance: result.wallet.balance,
      transaction: result.transaction,
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
          'Insufficient available balance to freeze',
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
    const virtualAccount = await this.ensureDedicatedAccount(userId);

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
