import { Test, TestingModule } from '@nestjs/testing';
import { AuditService } from './audit.service';
import { PrismaService } from '../../database/prisma.service';
import { RedactionService } from './redaction.service';

describe('AuditService', () => {
  let service: AuditService;
  let prisma: PrismaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuditService,
        {
          provide: RedactionService,
          useValue: {
            redact: jest.fn((val) => val),
          },
        },
        {
          provide: PrismaService,
          useValue: {
            auditEvent: {
              findMany: jest.fn(),
              count: jest.fn(),
              create: jest.fn(),
            },
          },
        },
      ],
    }).compile();

    service = module.get<AuditService>(AuditService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getAuditEvents', () => {
    it('should call prisma.auditEvent.findMany with correct parameters', async () => {
      const mockParams = {
        skip: 0,
        take: 10,
        where: { action: 'LOGIN' },
        orderBy: { timestamp: 'desc' as const },
      };

      const mockLogs = [{ id: '1', action: 'LOGIN' }];
      jest
        .spyOn(prisma.auditEvent, 'findMany')
        .mockResolvedValue(mockLogs as any);

      const result = await service.getAuditEvents(mockParams);

      expect(prisma.auditEvent.findMany).toHaveBeenCalledWith(mockParams);
      expect(result).toEqual(mockLogs);
    });
  });

  describe('countAuditEvents', () => {
    it('should call prisma.auditEvent.count with correct parameters', async () => {
      const mockWhere = { action: 'LOGIN' };
      const mockCount = 5;

      jest.spyOn(prisma.auditEvent, 'count').mockResolvedValue(mockCount);

      const result = await service.countAuditEvents(mockWhere);

      expect(prisma.auditEvent.count).toHaveBeenCalledWith({
        where: mockWhere,
      });
      expect(result).toBe(mockCount);
    });
  });
});
