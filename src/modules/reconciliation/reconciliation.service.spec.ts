import { Test, TestingModule } from '@nestjs/testing';
import { Logger } from '@nestjs/common';
import { ReconciliationService } from './reconciliation.service';
import { PrismaService } from '../../database/prisma.service';
import { PaystackClientService } from '../../common/services/paystack-client.service';
import { AlertingService } from '../monitoring/alerting.service';

describe('ReconciliationService', () => {
  let service: ReconciliationService;
  let prisma: PrismaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReconciliationService,
        {
          provide: PrismaService,
          useValue: {
            contract: {
              aggregate: jest.fn(),
            },
            auditLog: {
              create: jest.fn(),
              findMany: jest.fn(),
              count: jest.fn(),
            },
            ledgerAccount: {
              aggregate: jest.fn(),
            },
          },
        },
        {
          provide: PaystackClientService,
          useValue: {
            get: jest.fn(),
          },
        },
        {
          provide: AlertingService,
          useValue: {
            sendCriticalAlert: jest.fn(),
            resolveAlert: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<ReconciliationService>(ReconciliationService);
    prisma = module.get<PrismaService>(PrismaService);
    
    // Suppress expected logger output during tests
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => {});
    jest.spyOn(Logger.prototype, 'log').mockImplementation(() => {});
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => {});

    // Default mock setup for trial balance queries
    jest.spyOn(prisma.ledgerAccount, 'aggregate').mockResolvedValue({
      _sum: { balance: 0 },
    } as any);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('runReconciliation', () => {
    it('should report SUCCESS when total obligations match Paystack balance and trial balance is balanced', async () => {
      // Mock the internal obligations query
      const mockTotalObligations = 5000;
      jest.spyOn(prisma.contract, 'aggregate').mockResolvedValue({
        _sum: { amount: mockTotalObligations },
      } as any);

      // We spy on the private method to mock the Paystack response directly
      jest.spyOn(service as any, 'fetchPaystackDedicatedAccountBalance').mockResolvedValue(mockTotalObligations);
      jest.spyOn(prisma.auditLog, 'create').mockResolvedValue(null as any);

      const result = await service.runReconciliation();

      expect(result.status).toBe('SUCCESS');
      expect(result.totalObligations).toBe(mockTotalObligations);
      expect(result.actualPaystackBalance).toBe(mockTotalObligations);
      expect(result.discrepancy).toBe(0);

      // Verify Audit Log was NOT created (success is logged to console/alerting only)
      expect(prisma.auditLog.create).not.toHaveBeenCalled();
    });

    it('should report DISCREPANCY when Paystack balance differs from obligations', async () => {
      const mockTotalObligations = 5000;
      const mockPaystackBalance = 4900; // Missing funds!

      jest.spyOn(prisma.contract, 'aggregate').mockResolvedValue({
        _sum: { amount: mockTotalObligations },
      } as any);

      jest.spyOn(service as any, 'fetchPaystackDedicatedAccountBalance').mockResolvedValue(mockPaystackBalance);
      jest.spyOn(prisma.auditLog, 'create').mockResolvedValue(null as any);

      const result = await service.runReconciliation();

      expect(result.status).toBe('DISCREPANCY');
      expect(result.totalObligations).toBe(mockTotalObligations);
      expect(result.actualPaystackBalance).toBe(mockPaystackBalance);
      expect(result.discrepancy).toBe(-100);

      // Verify Audit Log captured the discrepancy
      expect(prisma.auditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          action: 'RECONCILIATION_DISCREPANCY',
          metadata: expect.objectContaining({
            totalObligations: mockTotalObligations,
            actualPaystackBalance: mockPaystackBalance,
            discrepancy: -100,
          }),
        }),
      });
    });

    it('should report DISCREPANCY and alert when Trial Balance is imbalanced', async () => {
      const mockTotalObligations = 5000;
      jest.spyOn(prisma.contract, 'aggregate').mockResolvedValue({
        _sum: { amount: mockTotalObligations },
      } as any);

      jest.spyOn(service as any, 'fetchPaystackDedicatedAccountBalance').mockResolvedValue(mockTotalObligations);
      jest.spyOn(prisma.auditLog, 'create').mockResolvedValue(null as any);

      // Setup imbalance
      jest.spyOn(prisma.ledgerAccount, 'aggregate').mockResolvedValue({
        _sum: { balance: 100 }, // Non-zero sum!
      } as any);

      const result = await service.runReconciliation();

      expect(result.status).toBe('DISCREPANCY');
      expect(result.trialBalanceStatus).toBe('IMBALANCED');
      expect(result.trialBalanceSum).toBe(100);

      expect(prisma.auditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          action: 'TRIAL_BALANCE_IMBALANCE',
        }),
      });
    });

    it('should throw an error if the database query fails', async () => {
      const mockError = new Error('Database connection failed');
      jest.spyOn(prisma.contract, 'aggregate').mockRejectedValue(mockError);

      await expect(service.runReconciliation()).rejects.toThrow('Database connection failed');
      expect(prisma.auditLog.create).not.toHaveBeenCalled();
    });
  });
});
