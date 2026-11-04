import { Test, TestingModule } from '@nestjs/testing';
import { DisputesService } from './disputes.service';
import { PrismaService } from '../../database/prisma.service';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { DisputeStatus, EvidenceType } from '../../generated/prisma';
import { DomainEventName } from '../../common/events/domain.events';
import {
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';

describe('DisputesService', () => {
  let service: DisputesService;
  let prisma: any;
  let eventEmitter: any;

  beforeEach(async () => {
    prisma = {
      contract: {
        findUnique: jest.fn(),
      },
      dispute: {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      disputeEvidence: {
        create: jest.fn(),
      },
      disputeHistory: {
        create: jest.fn(),
      },
    };

    eventEmitter = {
      emit: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DisputesService,
        { provide: PrismaService, useValue: prisma },
        { provide: EventEmitter2, useValue: eventEmitter },
      ],
    }).compile();

    service = module.get<DisputesService>(DisputesService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createDispute', () => {
    it('should throw NotFoundException if contract does not exist', async () => {
      prisma.contract.findUnique.mockResolvedValue(null);

      await expect(
        service.createDispute(
          'user-1',
          5000,
          'Quality issue',
          'Not done right',
          'contract-1',
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException if user is not a participant', async () => {
      prisma.contract.findUnique.mockResolvedValue({
        id: 'contract-1',
        clientId: 'client-1',
        artisanId: 'artisan-1',
      });

      await expect(
        service.createDispute(
          'random-user',
          5000,
          'Reason',
          'Desc',
          'contract-1',
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw BadRequestException if active dispute exists', async () => {
      prisma.contract.findUnique.mockResolvedValue({
        id: 'contract-1',
        clientId: 'client-1',
        artisanId: 'artisan-1',
      });
      prisma.dispute.findFirst.mockResolvedValue({
        id: 'dispute-existing',
        status: DisputeStatus.OPEN,
      });

      await expect(
        service.createDispute('client-1', 5000, 'Reason', 'Desc', 'contract-1'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should create dispute and mark contract disputed when valid', async () => {
      prisma.contract.findUnique.mockResolvedValue({
        id: 'contract-1',
        clientId: 'client-1',
        artisanId: 'artisan-1',
      });
      prisma.dispute.findFirst.mockResolvedValue(null);
      const mockCreated = {
        id: 'dispute-new',
        contractId: 'contract-1',
        status: DisputeStatus.OPEN,
      };
      prisma.dispute.create.mockResolvedValue(mockCreated);

      const result = await service.createDispute(
        'client-1',
        5000,
        'Reason',
        'Desc',
        'contract-1',
      );

      expect(prisma.dispute.create).toHaveBeenCalled();
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        DomainEventName.DISPUTE_RAISED,
        expect.any(Object),
      );
      expect(result).toEqual(mockCreated);
    });
  });

  describe('submitEvidence', () => {
    it('should throw NotFoundException if dispute does not exist', async () => {
      prisma.dispute.findUnique.mockResolvedValue(null);

      await expect(
        service.submitEvidence(
          'disp-1',
          'client-1',
          EvidenceType.PDF,
          'https://res.cloudinary.com/doc.pdf',
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException if user is not participant', async () => {
      prisma.dispute.findUnique.mockResolvedValue({
        id: 'disp-1',
        clientId: 'client-1',
        artisanId: 'artisan-1',
        status: DisputeStatus.OPEN,
      });

      await expect(
        service.submitEvidence(
          'disp-1',
          'random-user',
          EvidenceType.PDF,
          'https://res.cloudinary.com/doc.pdf',
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw BadRequestException if dispute is resolved or closed', async () => {
      prisma.dispute.findUnique.mockResolvedValue({
        id: 'disp-1',
        clientId: 'client-1',
        artisanId: 'artisan-1',
        status: DisputeStatus.RESOLVED,
      });

      await expect(
        service.submitEvidence(
          'disp-1',
          'client-1',
          EvidenceType.PDF,
          'https://res.cloudinary.com/doc.pdf',
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('should create evidence successfully when dispute is open', async () => {
      prisma.dispute.findUnique.mockResolvedValue({
        id: 'disp-1',
        clientId: 'client-1',
        artisanId: 'artisan-1',
        status: DisputeStatus.OPEN,
      });
      const mockEvidence = { id: 'evi-1', disputeId: 'disp-1' };
      prisma.disputeEvidence.create.mockResolvedValue(mockEvidence);

      const result = await service.submitEvidence(
        'disp-1',
        'client-1',
        EvidenceType.PDF,
        'https://res.cloudinary.com/doc.pdf',
      );

      expect(prisma.disputeEvidence.create).toHaveBeenCalled();
      expect(result).toEqual(mockEvidence);
    });
  });
});
