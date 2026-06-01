import { Test, TestingModule } from '@nestjs/testing';
import { ContractsService } from './contracts.service';
import { PrismaService } from '../../database/prisma.service';
import { ContractStatus } from '../../generated/prisma';
import { BadRequestException } from '@nestjs/common';
import { IdempotencyService } from '../../common/services/idempotency.service';

describe('Contracts FSM (State Machine)', () => {
  let service: ContractsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ContractsService,
        {
          provide: PrismaService,
          useValue: {}, // Mocked prisma
        },
        {
          provide: IdempotencyService,
          useValue: {
            checkIdempotency: jest.fn(),
            saveResponse: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<ContractsService>(ContractsService);
  });

  describe('validateStateTransition', () => {
    const validTransitions = [
      { from: ContractStatus.DRAFT, to: ContractStatus.PENDING_PAYMENT },
      { from: ContractStatus.DRAFT, to: ContractStatus.CANCELLED },
      { from: ContractStatus.PENDING_PAYMENT, to: ContractStatus.FUNDED },
      { from: ContractStatus.FUNDED, to: ContractStatus.ACTIVE },
      { from: ContractStatus.ACTIVE, to: ContractStatus.IN_PROGRESS },
      { from: ContractStatus.IN_PROGRESS, to: ContractStatus.CLIENT_CONFIRMED },
      { from: ContractStatus.CLIENT_CONFIRMED, to: ContractStatus.READY_FOR_PAYOUT },
      { from: ContractStatus.READY_FOR_PAYOUT, to: ContractStatus.PAID_OUT },
      { from: ContractStatus.ACTIVE, to: ContractStatus.DISPUTED },
      { from: ContractStatus.DISPUTED, to: ContractStatus.REFUNDED },
    ];

    const invalidTransitions = [
      { from: ContractStatus.DRAFT, to: ContractStatus.COMPLETED },
      { from: ContractStatus.PENDING_PAYMENT, to: ContractStatus.PAID_OUT },
      { from: ContractStatus.PAID_OUT, to: ContractStatus.ACTIVE },
      { from: ContractStatus.COMPLETED, to: ContractStatus.DRAFT },
    ];

    validTransitions.forEach(({ from, to }) => {
      it(`should allow transition from ${from} to ${to}`, () => {
        expect(() => (service as any).validateStateTransition(from, to)).not.toThrow();
      });
    });

    invalidTransitions.forEach(({ from, to }) => {
      it(`should NOT allow transition from ${from} to ${to}`, () => {
        expect(() => (service as any).validateStateTransition(from, to)).toThrow(BadRequestException);
      });
    });
  });
});
