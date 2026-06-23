import { Test, TestingModule } from '@nestjs/testing';
import { WalletService } from './wallet.service';
import { PrismaService } from '../../database/prisma.service';
import { AppConfigService } from '../../config/app-config.service';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { v7 as uuidv7 } from 'uuid';
import { PaystackClientService } from '../../common/services/paystack-client.service';

describe('WalletService', () => {
  let service: WalletService;
  let prisma: PrismaService;

  const mockPrismaService: any = {
    wallet: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    transaction: {
      create: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      findUnique: jest.fn(),
    },
    user: {
      findUnique: jest.fn(),
    },
    $transaction: jest.fn((callback) => callback(mockPrismaService)),
  };

  const mockAppConfigService = {
    paystackSecret: 'test_secret',
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WalletService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: AppConfigService, useValue: mockAppConfigService },
        { 
          provide: PaystackClientService, 
          useValue: {
            initializeTransaction: jest.fn(),
            verifyTransaction: jest.fn(),
            isConfigured: jest.fn().mockReturnValue(true),
            createDedicatedVirtualAccount: jest.fn().mockResolvedValue({
              account_name: 'Test Account',
              account_number: '1234567890',
              bank: { name: 'Test Bank' },
            }),
          } 
        },
      ],
    }).compile();

    service = module.get<WalletService>(WalletService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getWalletBalance', () => {
    it('should return the balance of an existing wallet', async () => {
      const userId = 'user-1';
      const mockWallet = { userId, balance: 1000, frozen: 200, version: 1 };
      mockPrismaService.wallet.findUnique.mockResolvedValue(mockWallet);

      const result = await service.getWalletBalance(userId);

      expect(result).toEqual(expect.objectContaining({
        balance: 1000,
        available: 800,
        frozen: 200,
        exists: true,
      }));
    });

    it('should return zero balance if wallet does not exist', async () => {
      mockPrismaService.wallet.findUnique.mockResolvedValue(null);

      const result = await service.getWalletBalance('invalid');
      
      expect(result).toEqual(expect.objectContaining({
        balance: 0,
        available: 0,
        frozen: 0,
        exists: false,
      }));
    });
  });

  describe('initiateWalletDeposit', () => {
    const userId = 'user-1';
    const amount = 5000;
    const reference = 'ref-123';

    it('should successfully add funds and create a transaction', async () => {
      const mockWallet = { id: 'w-1', userId, balance: 0, version: 1 };
      mockPrismaService.wallet.findUnique.mockResolvedValue(mockWallet);
      mockPrismaService.transaction.findUnique.mockResolvedValue(null);
      mockPrismaService.wallet.update.mockResolvedValue({ ...mockWallet, balance: amount });

      const result = await service.initiateWalletDeposit(userId, amount, 'test@example.com');

      expect(result.authorizationUrl).toBeDefined();
      expect(result.reference).toBeDefined();
      expect(prisma.wallet.update).toHaveBeenCalled();
      expect(prisma.transaction.create).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({
          userId,
          amount,
          type: 'FUNDING',
          status: 'COMPLETED',
          reference,
        }),
      }));
    });

    it('should throw BadRequestException for non-positive amounts', async () => {
      await expect(service.initiateWalletDeposit(userId, 0, 'test@example.com')).rejects.toThrow(BadRequestException);
      await expect(service.initiateWalletDeposit(userId, -100, 'test@example.com')).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException if reference is already used', async () => {
      mockPrismaService.transaction.findUnique.mockResolvedValue({ id: 'tx-1' });

      await expect(service.initiateWalletDeposit(userId, amount, 'test@example.com')).rejects.toThrow(BadRequestException);
    });
  });

  describe('freezeFunds', () => {
    it('should move funds from balance to frozen', async () => {
      const userId = 'user-1';
      const amount = 500;
      const mockWallet = { id: 'w-1', userId, balance: 1000, frozen: 0, version: 1 };
      
      mockPrismaService.wallet.findUnique.mockResolvedValue(mockWallet);
      mockPrismaService.wallet.update.mockResolvedValue({ 
        id: 'w-1',
        userId,
        balance: 500, 
        frozen: 500 
      });

      const result = await service.freezeFunds(userId, amount, 'escrow-ref');

      expect(result.message).toContain('successfully');
      expect(result.balance).toBe(500);
      expect(result.frozen).toBe(500);
      expect(prisma.wallet.update).toHaveBeenCalled();
    });

    it('should throw BadRequestException if insufficient available funds', async () => {
      const userId = 'user-1';
      const mockWallet = { id: 'w-1', userId, balance: 300, frozen: 0, version: 1 };
      mockPrismaService.wallet.findUnique.mockResolvedValue(mockWallet);

      await expect(service.freezeFunds(userId, 500, 'ref')).rejects.toThrow(BadRequestException);
    });
  });
});
