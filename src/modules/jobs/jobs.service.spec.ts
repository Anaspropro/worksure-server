import { Test, TestingModule } from '@nestjs/testing';
import { JobsService } from './jobs.service';
import { PrismaService } from '../../database/prisma.service';
import { UserRole } from '../../common/constants/roles.constants';
import { JobStatus, UserRole as PrismaUserRole } from '../../generated/prisma';
import { ForbiddenException, NotFoundException, BadRequestException } from '@nestjs/common';
import { v7 as uuidv7 } from 'uuid';

import { EventEmitter2 } from '@nestjs/event-emitter';

describe('JobsService', () => {
  let service: JobsService;
  let prisma: PrismaService;

  const mockPrismaService: any = {
    job: {
      create: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    user: {
      findUnique: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        JobsService,
        { provide: PrismaService, useValue: mockPrismaService },
        {
          provide: EventEmitter2,
          useValue: {
            emit: jest.fn(),
            emitAsync: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<JobsService>(JobsService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('createJob', () => {
    const clientUser = { id: 'client-1', role: 'CLIENT' as PrismaUserRole };
    const createDto = {
      title: 'Fix my sink',
      description: 'The sink is leaking',
      budget: 5000,
      category: 'Plumbing',
    };

    it('should successfully create a job when user is a CLIENT', async () => {
      const mockJob = {
        ...createDto,
        id: 'job-1',
        clientId: clientUser.id,
        status: JobStatus.OPEN,
        createdAt: new Date(),
        updatedAt: new Date(),
        requiredSkills: '[]',
      };

      mockPrismaService.job.create.mockResolvedValue(mockJob);

      const result = await service.createJob(clientUser, createDto as any);

      expect(result.id).toBe('job-1');
      expect(result.title).toBe(createDto.title);
      expect(prisma.job.create).toHaveBeenCalled();
    });

    it('should throw ForbiddenException if user is not a CLIENT', async () => {
      const artisanUser = { id: 'artisan-1', role: 'ARTISAN' as PrismaUserRole };
      
      await expect(service.createJob(artisanUser, createDto as any))
        .rejects.toThrow(ForbiddenException);
    });
  });

  describe('updateJob', () => {
    const owner = { id: 'client-1', role: 'CLIENT' as PrismaUserRole };
    const admin = { id: 'admin-1', role: 'ADMIN' as PrismaUserRole };
    const stranger = { id: 'stranger-1', role: 'CLIENT' as PrismaUserRole };
    
    const existingJob = {
      id: 'job-1',
      clientId: owner.id,
      title: 'Old Title',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    it('should allow the owner to update the job', async () => {
      mockPrismaService.job.findUnique.mockResolvedValue(existingJob);
      mockPrismaService.job.update.mockResolvedValue({ ...existingJob, title: 'New Title' });

      const result = await service.updateJob(owner, 'job-1', { title: 'New Title' });

      expect(result.title).toBe('New Title');
      expect(prisma.job.update).toHaveBeenCalled();
    });

    it('should allow an admin to update any job', async () => {
      mockPrismaService.job.findUnique.mockResolvedValue(existingJob);
      mockPrismaService.job.update.mockResolvedValue({ ...existingJob, title: 'Admin Title' });

      const result = await service.updateJob(admin, 'job-1', { title: 'Admin Title' });

      expect(result.title).toBe('Admin Title');
    });

    it('should throw ForbiddenException if a stranger tries to update the job', async () => {
      mockPrismaService.job.findUnique.mockResolvedValue(existingJob);

      await expect(service.updateJob(stranger, 'job-1', { title: 'New Title' }))
        .rejects.toThrow(ForbiddenException);
    });

    it('should throw NotFoundException if job does not exist', async () => {
      mockPrismaService.job.findUnique.mockResolvedValue(null);

      await expect(service.updateJob(owner, 'invalid', { title: 'New Title' }))
        .rejects.toThrow(NotFoundException);
    });
  });

  describe('deleteJob', () => {
    it('should prevent deletion if job has an active contract', async () => {
      const owner = { id: 'client-1', role: 'CLIENT' as PrismaUserRole };
      const jobWithContract = { id: 'job-1', clientId: owner.id, contractId: 'contract-1' };
      
      mockPrismaService.job.findUnique.mockResolvedValue(jobWithContract);

      await expect(service.deleteJob(owner, 'job-1'))
        .rejects.toThrow(BadRequestException);
    });
  });

  describe('assignArtisan', () => {
    it('should correctly assign an artisan and update status', async () => {
      const owner = { id: 'client-1', role: 'CLIENT' as PrismaUserRole };
      const job = { id: 'job-1', clientId: owner.id };
      const artisan = { id: 'artisan-1', role: 'ARTISAN' as PrismaUserRole };

      mockPrismaService.job.findUnique.mockResolvedValue(job);
      mockPrismaService.user.findUnique.mockResolvedValue(artisan);
      mockPrismaService.job.update.mockResolvedValue({
        ...job,
        artisanId: artisan.id,
        status: JobStatus.IN_PROGRESS,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await service.assignArtisan(owner, 'job-1', 'artisan-1');

      expect(result.status).toBe(JobStatus.IN_PROGRESS);
      expect(prisma.job.update).toHaveBeenCalledWith(expect.objectContaining({
        data: { artisanId: 'artisan-1', status: JobStatus.IN_PROGRESS }
      }));
    });
  });
});
