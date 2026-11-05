import { Test, TestingModule } from '@nestjs/testing';
import { FinancialVerificationService } from './financial.service';
import { PrismaService } from '../../database/prisma.service';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PaystackVerificationProvider } from './providers/paystack.provider';
import { PaystackClientService } from '../../common/services/paystack-client.service';
import { BadRequestException } from '@nestjs/common';
import { FinancialVerificationStatus } from '../../generated/prisma';

describe('FinancialVerificationService', () => {
  let service: FinancialVerificationService;
  let prisma: any;
  let eventEmitter: any;
  let identityProvider: any;
  let paystackClient: any;

  beforeEach(async () => {
    prisma = {
      user: {
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      artisanVerification: {
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        upsert: jest.fn(),
      },
      $transaction: jest.fn((promises) => Promise.all(promises)),
    };

    eventEmitter = {
      emit: jest.fn(),
    };

    identityProvider = {
      initiateVerification: jest.fn(),
      verifyWebhookSignature: jest.fn(),
      parseWebhook: jest.fn(),
    };

    paystackClient = {
      call: jest.fn(),
      get: jest.fn(),
      isConfigured: jest.fn().mockReturnValue(true),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FinancialVerificationService,
        { provide: PrismaService, useValue: prisma },
        { provide: EventEmitter2, useValue: eventEmitter },
        { provide: PaystackVerificationProvider, useValue: identityProvider },
        { provide: PaystackClientService, useValue: paystackClient },
      ],
    }).compile();

    service = module.get<FinancialVerificationService>(
      FinancialVerificationService,
    );
  });

  describe('verifyNameMatch', () => {
    it('should match identical names', () => {
      expect(service.verifyNameMatch('Aliu Anas', 'Aliu Anas')).toBe(true);
    });

    it('should match reversed name tokens (Nigerian bank order)', () => {
      expect(service.verifyNameMatch('Aliu Anas', 'ANAS ALIU')).toBe(true);
    });

    it('should match when bank includes middle name', () => {
      expect(service.verifyNameMatch('Aliu Anas', 'ALIU ANAS MOHAMMED')).toBe(true);
    });

    it('should reject completely different names', () => {
      expect(service.verifyNameMatch('John Doe', 'EMMANUEL ADEBAYO')).toBe(false);
    });

    it('should reject empty or missing names', () => {
      expect(service.verifyNameMatch('', 'ANAS ALIU')).toBe(false);
      expect(service.verifyNameMatch('Aliu Anas', '')).toBe(false);
    });
  });

  describe('resolveBankAccount', () => {
    it('should successfully resolve account, verify name match, and update user payout details', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: 'user-1',
        name: 'Aliu Anas',
      });

      paystackClient.call.mockResolvedValue({
        account_number: '0123456789',
        account_name: 'ANAS ALIU',
        bank_id: 9,
      });

      prisma.user.update.mockResolvedValue({
        id: 'user-1',
        payoutAccountNumber: '0123456789',
        payoutBankCode: '058',
        payoutAccountName: 'ANAS ALIU',
      });

      prisma.artisanVerification.upsert.mockResolvedValue({
        userId: 'user-1',
        financialStatus: FinancialVerificationStatus.VERIFIED,
        marketplaceStatus: 'APPROVED',
      });

      const result = await service.resolveBankAccount(
        'user-1',
        '0123456789',
        '058',
      );

      expect(result.verified).toBe(true);
      expect(result.accountName).toBe('ANAS ALIU');
      expect(result.isPayoutEligible).toBe(true);
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        'financial.verification.succeeded',
        { userId: 'user-1' },
      );
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        'payout.eligibility.granted',
        { userId: 'user-1' },
      );
    });

    it('should reject invalid account number format', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: 'user-1',
        name: 'Aliu Anas',
      });

      await expect(
        service.resolveBankAccount('user-1', '123', '058'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject when resolved bank name does not match user name', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: 'user-1',
        name: 'Aliu Anas',
      });

      paystackClient.call.mockResolvedValue({
        account_number: '0123456789',
        account_name: 'CHINEDU OKONKWO',
        bank_id: 9,
      });

      await expect(
        service.resolveBankAccount('user-1', '0123456789', '058'),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('getBanks', () => {
    it('should return bank list from Paystack or fallback', async () => {
      paystackClient.get.mockResolvedValue([
        { name: 'Guaranty Trust Bank', code: '058', slug: 'gtb' },
      ]);

      const banks = await service.getBanks();
      expect(banks.length).toBeGreaterThan(0);
      expect(banks[0].code).toBe('058');
    });

    it('should fallback to static banks if Paystack fails', async () => {
      paystackClient.get.mockRejectedValue(new Error('Network error'));

      const banks = await service.getBanks();
      expect(banks.length).toBeGreaterThanOrEqual(10);
      expect(banks.some((b) => b.code === '058')).toBe(true);
    });
  });
});
