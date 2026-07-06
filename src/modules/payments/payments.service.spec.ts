import { Test, TestingModule } from '@nestjs/testing';
import { PaymentsService } from './payments.service';
import { PrismaService } from '../../database/prisma.service';
import { ContractsService } from '../contracts/contracts.service';
import { PaystackClientService } from '../../common/services/paystack-client.service';
import { IdempotencyService } from '../../common/services/idempotency.service';
import { TransactionType, TransactionStatus } from '../../generated/prisma';

import { EventEmitter2 } from '@nestjs/event-emitter';
import { WalletService } from '../wallet/wallet.service';

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
    contract: {
      findUnique: jest.fn().mockResolvedValue({
        id: 'contract_123',
        job: { id: 'job_123', title: 'Plumbing Job' },
      }),
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
        {
          provide: WalletService,
          useValue: {
            freezeFunds: jest.fn(),
            unfreezeFunds: jest.fn(),
          },
        },
        {
          provide: EventEmitter2,
          useValue: {
            emit: jest.fn(),
            emitAsync: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<PaymentsService>(PaymentsService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

});
