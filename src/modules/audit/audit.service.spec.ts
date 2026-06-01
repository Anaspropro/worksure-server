import { Test, TestingModule } from '@nestjs/testing';
import { AuditService } from './audit.service';
import { PrismaService } from '../../database/prisma.service';

describe('AuditService', () => {
  let service: AuditService;
  let prisma: PrismaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuditService,
        {
          provide: PrismaService,
          useValue: {
            auditLog: {
              findMany: jest.fn(),
              count: jest.fn(),
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

  describe('getAuditLogs', () => {
    it('should call prisma.auditLog.findMany with correct parameters', async () => {
      const mockParams = {
        skip: 0,
        take: 10,
        where: { action: 'LOGIN' },
        orderBy: { performedAt: 'desc' },
      };

      const mockLogs = [{ id: '1', action: 'LOGIN' }];
      jest.spyOn(prisma.auditLog, 'findMany').mockResolvedValue(mockLogs as any);

      const result = await service.getAuditLogs(mockParams);

      expect(prisma.auditLog.findMany).toHaveBeenCalledWith(mockParams);
      expect(result).toEqual(mockLogs);
    });
  });

  describe('countAuditLogs', () => {
    it('should call prisma.auditLog.count with correct parameters', async () => {
      const mockWhere = { action: 'LOGIN' };
      const mockCount = 5;

      jest.spyOn(prisma.auditLog, 'count').mockResolvedValue(mockCount);

      const result = await service.countAuditLogs(mockWhere);

      expect(prisma.auditLog.count).toHaveBeenCalledWith({ where: mockWhere });
      expect(result).toBe(mockCount);
    });
  });
});
