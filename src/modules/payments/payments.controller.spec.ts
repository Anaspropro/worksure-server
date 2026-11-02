import { Test, TestingModule } from '@nestjs/testing';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';
import { PrismaService } from '../../database/prisma.service';
import { WebhookSignatureService } from '../../common/services/webhook-signature.service';
import { PaystackWebhookService } from './paystack-webhook.service';
import { UserRole } from '../../common/constants/roles.constants';

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { ThrottlerGuard } from '@nestjs/throttler';

describe('PaymentsController', () => {
  let controller: PaymentsController;
  let mockPaymentsService: any;
  let mockWebhookSignatureService: any;
  let mockPaystackWebhookService: any;
  let mockPrismaService: any;

  beforeEach(async () => {
    mockPaymentsService = {
      completeContract: jest.fn(),
    };
    mockWebhookSignatureService = {
      verifyAndParseWebhook: jest.fn(),
      isEventProcessed: jest.fn(),
      tryBeginEventProcessing: jest.fn(),
      markEventProcessed: jest.fn(),
    };
    mockPaystackWebhookService = {
      processPaystackWebhook: jest.fn(),
    };
    mockPrismaService = {};

    const module: TestingModule = await Test.createTestingModule({
      controllers: [PaymentsController],
      providers: [
        { provide: PaymentsService, useValue: mockPaymentsService },
        {
          provide: WebhookSignatureService,
          useValue: mockWebhookSignatureService,
        },
        {
          provide: PaystackWebhookService,
          useValue: mockPaystackWebhookService,
        },
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(RolesGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(ThrottlerGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<PaymentsController>(PaymentsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('completeContract', () => {
    const mockDto = {
      contractId: 'contract-123',
      role: 'artisan' as const, // This body parameter should be completely ignored!
    };

    it('should call completeContract with isClient = true when user role is CLIENT', async () => {
      const mockUser = {
        id: 'user-client',
        sub: 'user-client',
        email: 'client@example.com',
        role: UserRole.CLIENT,
        sessionId: 'session-client',
      };

      mockPaymentsService.completeContract.mockResolvedValue({
        id: 'contract-123',
        status: 'COMPLETED',
      });

      const result = await controller.completeContract(mockUser, mockDto);

      expect(mockPaymentsService.completeContract).toHaveBeenCalledWith(
        'contract-123',
        'user-client',
        true, // isClient should be true
      );
      expect(result.data).toBeDefined();
    });

    it('should call completeContract with isClient = false when user role is ARTISAN', async () => {
      const mockUser = {
        id: 'user-artisan',
        sub: 'user-artisan',
        email: 'artisan@example.com',
        role: UserRole.ARTISAN,
        sessionId: 'session-artisan',
      };

      mockPaymentsService.completeContract.mockResolvedValue({
        id: 'contract-123',
        status: 'COMPLETED',
      });

      await controller.completeContract(mockUser, mockDto);

      expect(mockPaymentsService.completeContract).toHaveBeenCalledWith(
        'contract-123',
        'user-artisan',
        false, // isClient should be false
      );
    });
  });
});
