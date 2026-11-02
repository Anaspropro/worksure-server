import { Test, TestingModule } from '@nestjs/testing';
import { ProposalsService } from './proposals.service';
import { PrismaService } from '../../database/prisma.service';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { ProposalStatus, JobStatus, UserRole } from '../../generated/prisma';
import {
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';

describe('ProposalsService', () => {
  let service: ProposalsService;
  let prisma: any;
  let eventEmitter: any;

  beforeEach(async () => {
    prisma = {
      job: {
        findUnique: jest.fn(),
      },
      proposal: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        count: jest.fn(),
      },
    };

    eventEmitter = {
      emit: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProposalsService,
        { provide: PrismaService, useValue: prisma },
        { provide: EventEmitter2, useValue: eventEmitter },
      ],
    }).compile();

    service = module.get<ProposalsService>(ProposalsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getProposal', () => {
    it('should throw NotFoundException if proposal not found', async () => {
      prisma.proposal.findUnique.mockResolvedValue(null);

      await expect(
        service.getProposal({ id: 'u1', role: UserRole.ARTISAN }, 'p1'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException if user is not client, artisan, or admin', async () => {
      prisma.proposal.findUnique.mockResolvedValue({
        id: 'p1',
        clientId: 'client-1',
        artisanId: 'artisan-1',
      });

      await expect(
        service.getProposal(
          { id: 'random-user', role: UserRole.ARTISAN },
          'p1',
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should return proposal if user is the client', async () => {
      const mockProposal = {
        id: 'p1',
        clientId: 'client-1',
        artisanId: 'artisan-1',
        amount: 50000,
        message: 'Hello',
        status: ProposalStatus.SUBMITTED,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      prisma.proposal.findUnique.mockResolvedValue(mockProposal);

      const result = await service.getProposal(
        { id: 'client-1', role: UserRole.CLIENT },
        'p1',
      );
      expect(result.id).toBe('p1');
    });

    it('should return proposal if user is an ADMIN', async () => {
      const mockProposal = {
        id: 'p1',
        clientId: 'client-1',
        artisanId: 'artisan-1',
        amount: 50000,
        message: 'Hello',
        status: ProposalStatus.SUBMITTED,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      prisma.proposal.findUnique.mockResolvedValue(mockProposal);

      const result = await service.getProposal(
        { id: 'admin-1', role: UserRole.ADMIN },
        'p1',
      );
      expect(result.id).toBe('p1');
    });
  });

  describe('compareProposals', () => {
    it('should throw NotFoundException if job not found', async () => {
      prisma.job.findUnique.mockResolvedValue(null);

      await expect(
        service.compareProposals({ id: 'c1', role: UserRole.CLIENT }, 'j1'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException if user is not job owner and not admin', async () => {
      prisma.job.findUnique.mockResolvedValue({
        id: 'j1',
        clientId: 'owner-client',
      });

      await expect(
        service.compareProposals(
          { id: 'other-user', role: UserRole.CLIENT },
          'j1',
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should return comparisons if user is job owner', async () => {
      prisma.job.findUnique.mockResolvedValue({
        id: 'j1',
        clientId: 'owner-client',
      });
      prisma.proposal.findMany.mockResolvedValue([
        {
          id: 'p1',
          amount: 30000,
          message: 'Can do this quickly',
          attachments: [],
          artisan: {
            name: 'Artisan One',
            artisanProfile: { rating: 4.8, verified: true },
          },
        },
      ]);

      const result = await service.compareProposals(
        { id: 'owner-client', role: UserRole.CLIENT },
        'j1',
      );
      expect(result).toHaveLength(1);
      expect(result[0].artisanName).toBe('Artisan One');
      expect(result[0].bid).toBe(30000);
    });
  });
});
