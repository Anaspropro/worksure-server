import { Test, TestingModule } from '@nestjs/testing';
import { PaymentsService } from './payments.service';
import { PrismaService } from '../../database/prisma.service';
import { ContractsService } from '../contracts/contracts.service';
import { PaystackClientService } from '../../common/services/paystack-client.service';
import { IdempotencyService } from '../../common/services/idempotency.service';
import { TransactionType, TransactionStatus } from '../../generated/prisma';

describe('PaymentsService Webhook Processing', () => {
  let service: PaymentsService;
  let prisma: PrismaService;

  const mockPrisma: any = {
    $transaction: jest.fn((callback) => callback(mockPrisma)),
    $queryRaw: jest.fn().mockResolvedValue([{ id: 'some-id' }]),
    transaction: {
      findFirst: jest.fn(),
      update: jest.fn(),
      create: jest.fn(),
    },
    payment: {
      findFirst: jest.fn(),
      update: jest.fn(),
    },
    ledgerAccount: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    ledgerEntry: {
      create: jest.fn(),
    },
    financialEvent: {
      create: jest.fn(),
    },
    auditLog: {
      create: jest.fn(),
    },
  };

  const mockContractsService: any = {
    markPaidOut: jest.fn(),
    markRefunded: jest.fn(),
  };

  const mockPaystackClient: any = {
    call: jest.fn(),
  };

  const mockIdempotency: any = {
    tryAcquire: jest.fn(),
    complete: jest.fn(),
    release: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PaymentsService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: ContractsService, useValue: mockContractsService },
        { provide: PaystackClientService, useValue: mockPaystackClient },
        { provide: IdempotencyService, useValue: mockIdempotency },
      ],
    }).compile();

    service = module.get<PaymentsService>(PaymentsService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('processPaystackWebhook - transfer.success', () => {
    it('should complete transfer transaction and write balanced ledger entries on payout success', async () => {
      const payload = {
        event: 'transfer.success',
        data: {
          reference: 'ref_123',
          transfer_code: 'tr_code_123',
        },
      };

      const mockTransferTx = {
        id: 'tx_123',
        userId: 'artisan_1',
        type: TransactionType.TRANSFER,
        amount: 9000,
        status: TransactionStatus.PENDING,
        metadata: {
          contractId: 'contract_123',
          platformFee: 1000,
        },
      };

      mockPrisma.transaction.findFirst.mockResolvedValue(mockTransferTx);
      
      const mockEscrowAccount = { id: 'escrow_acc', type: 'SYSTEM_ESCROW', balance: 10000 };
      const mockArtisanWallet = { id: 'artisan_wallet', type: 'USER_WALLET', userId: 'artisan_1', balance: 0 };
      const mockFeeAccount = { id: 'fee_acc', type: 'SYSTEM_FEE', balance: 0 };

      mockPrisma.ledgerAccount.findFirst.mockImplementation((args: any) => {
        if (args.where?.type === 'SYSTEM_ESCROW') return Promise.resolve(mockEscrowAccount);
        if (args.where?.type === 'SYSTEM_FEE') return Promise.resolve(mockFeeAccount);
        return Promise.resolve(null);
      });

      mockPrisma.ledgerAccount.findUnique.mockResolvedValue(mockArtisanWallet);

      const result = await service.processPaystackWebhook(payload);

      expect(result).toEqual({ handled: true, event: 'transfer.success' });
      
      // Verify transaction update to completed
      expect(mockPrisma.transaction.update).toHaveBeenCalledWith(expect.objectContaining({
        where: { id: 'tx_123' },
        data: expect.objectContaining({ status: TransactionStatus.COMPLETED }),
      }));

      // Verify ledger entries created
      expect(mockPrisma.ledgerEntry.create).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({
          debitAccountId: 'escrow_acc',
          creditAccountId: 'artisan_wallet',
          amount: 9000,
          contractId: 'contract_123',
        }),
      }));

      expect(mockPrisma.ledgerEntry.create).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({
          debitAccountId: 'escrow_acc',
          creditAccountId: 'fee_acc',
          amount: 1000,
          contractId: 'contract_123',
        }),
      }));

      // Verify balance updates
      expect(mockPrisma.ledgerAccount.update).toHaveBeenCalledWith(expect.objectContaining({
        where: { id: 'escrow_acc' },
        data: { balance: { decrement: 10000 } },
      }));

      expect(mockPrisma.ledgerAccount.update).toHaveBeenCalledWith(expect.objectContaining({
        where: { id: 'artisan_wallet' },
        data: { balance: { increment: 9000 } },
      }));

      expect(mockPrisma.ledgerAccount.update).toHaveBeenCalledWith(expect.objectContaining({
        where: { id: 'fee_acc' },
        data: { balance: { increment: 1000 } },
      }));
    });
  });

  describe('processPaystackWebhook - refund.processed', () => {
    it('should complete refund transaction and write balanced ledger entries on refund processed success', async () => {
      const payload = {
        event: 'refund.processed',
        data: {
          transaction_reference: 'payment_ref_123',
          merchant_note: 'Refund processed',
        },
      };

      const mockPayment = {
        id: 'payment_123',
        contractId: 'contract_123',
        userId: 'client_1',
        amount: 10000,
        paymentReference: 'payment_ref_123',
      };

      const mockRefundTx = {
        id: 'refund_tx_123',
        userId: 'client_1',
        type: TransactionType.REFUND,
        amount: 10000,
        status: TransactionStatus.PENDING,
      };

      mockPrisma.payment.findFirst.mockResolvedValue(mockPayment);
      mockPrisma.transaction.findFirst.mockResolvedValue(mockRefundTx);

      const mockEscrowAccount = { id: 'escrow_acc', type: 'SYSTEM_ESCROW', balance: 10000 };
      const mockClientWallet = { id: 'client_wallet', type: 'USER_WALLET', userId: 'client_1', balance: 0 };

      mockPrisma.ledgerAccount.findFirst.mockImplementation((args: any) => {
        if (args.where?.type === 'SYSTEM_ESCROW') return Promise.resolve(mockEscrowAccount);
        return Promise.resolve(null);
      });

      mockPrisma.ledgerAccount.findUnique.mockResolvedValue(mockClientWallet);

      const result = await service.processPaystackWebhook(payload);

      expect(result).toEqual({ handled: true, event: 'refund.processed' });

      // Verify transaction update to completed
      expect(mockPrisma.transaction.update).toHaveBeenCalledWith(expect.objectContaining({
        where: { id: 'refund_tx_123' },
        data: expect.objectContaining({ status: TransactionStatus.COMPLETED }),
      }));

      // Verify ledger entries created
      expect(mockPrisma.ledgerEntry.create).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({
          debitAccountId: 'escrow_acc',
          creditAccountId: 'client_wallet',
          amount: 10000,
          contractId: 'contract_123',
        }),
      }));

      // Verify balance updates
      expect(mockPrisma.ledgerAccount.update).toHaveBeenCalledWith(expect.objectContaining({
        where: { id: 'escrow_acc' },
        data: { balance: { decrement: 10000 } },
      }));

      expect(mockPrisma.ledgerAccount.update).toHaveBeenCalledWith(expect.objectContaining({
        where: { id: 'client_wallet' },
        data: { balance: { increment: 10000 } },
      }));
    });
  });
});
