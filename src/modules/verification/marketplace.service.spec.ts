import { Test, TestingModule } from '@nestjs/testing';
import { MarketplaceVerificationService } from './marketplace.service';
import { PrismaService } from '../../database/prisma.service';
import { EventEmitter2 } from '@nestjs/event-emitter';
import {
  MarketplaceVerificationStatus,
  KycDocumentStatus,
} from '../../generated/prisma';

describe('MarketplaceVerificationService', () => {
  let service: MarketplaceVerificationService;
  let prisma: any;
  let eventEmitter: any;

  beforeEach(async () => {
    prisma = {
      artisanVerification: {
        upsert: jest.fn(),
        findMany: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      user: {
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      artisanProfile: {
        updateMany: jest.fn(),
      },
      kycDocument: {
        findUnique: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
      },
      $transaction: jest.fn((promises) => Promise.all(promises)),
    };

    eventEmitter = {
      emit: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MarketplaceVerificationService,
        { provide: PrismaService, useValue: prisma },
        { provide: EventEmitter2, useValue: eventEmitter },
      ],
    }).compile();

    service = module.get<MarketplaceVerificationService>(
      MarketplaceVerificationService,
    );
  });

  it('should submit profile for review and emit event', async () => {
    const mockVerification = {
      userId: 'user-1',
      marketplaceStatus: MarketplaceVerificationStatus.PENDING_REVIEW,
    };
    prisma.artisanVerification.upsert.mockResolvedValue(mockVerification);

    const result = await service.submitProfile('user-1');

    expect(result.marketplaceStatus).toBe(
      MarketplaceVerificationStatus.PENDING_REVIEW,
    );
    expect(eventEmitter.emit).toHaveBeenCalledWith(
      'marketplace.verification.submitted',
      { userId: 'user-1' },
    );
  });

  it('should approve marketplace verification, synchronize User.artisanVerified and emit events', async () => {
    const mockVerification = {
      userId: 'user-1',
      marketplaceStatus: MarketplaceVerificationStatus.APPROVED,
      financialStatus: 'VERIFIED',
    };

    prisma.artisanVerification.update.mockResolvedValue(mockVerification);
    prisma.user.update.mockResolvedValue({ id: 'user-1', artisanVerified: true });
    prisma.artisanProfile.updateMany.mockResolvedValue({ count: 1 });
    prisma.kycDocument.updateMany.mockResolvedValue({ count: 1 });

    const result = await service.approve('user-1', 'admin-1');

    expect(result.marketplaceStatus).toBe(
      MarketplaceVerificationStatus.APPROVED,
    );
    expect(prisma.$transaction).toHaveBeenCalled();
    expect(eventEmitter.emit).toHaveBeenCalledWith(
      'marketplace.verification.approved',
      { userId: 'user-1' },
    );
    expect(eventEmitter.emit).toHaveBeenCalledWith(
      'payout.eligibility.granted',
      { userId: 'user-1' },
    );
  });

  it('should reject marketplace verification and revoke artisanVerified', async () => {
    const mockVerification = {
      userId: 'user-1',
      marketplaceStatus: MarketplaceVerificationStatus.REJECTED,
      financialStatus: 'NOT_STARTED',
    };

    prisma.artisanVerification.update.mockResolvedValue(mockVerification);
    prisma.user.update.mockResolvedValue({ id: 'user-1', artisanVerified: false });
    prisma.artisanProfile.updateMany.mockResolvedValue({ count: 1 });
    prisma.kycDocument.updateMany.mockResolvedValue({ count: 1 });

    const result = await service.reject('user-1', 'Incomplete credentials', 'admin-1');

    expect(result.marketplaceStatus).toBe(
      MarketplaceVerificationStatus.REJECTED,
    );
    expect(prisma.$transaction).toHaveBeenCalled();
    expect(eventEmitter.emit).toHaveBeenCalledWith(
      'marketplace.verification.rejected',
      { userId: 'user-1' },
    );
  });
});
