import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from './prisma.service';
import { AppConfigService } from '../config/app-config.service';
import { ClsService } from 'nestjs-cls';

describe('PrismaService RLS', () => {
  let service: PrismaService;
  let mockCls: Partial<ClsService>;

  beforeEach(async () => {
    mockCls = {
      isActive: jest.fn().mockReturnValue(true),
      get: jest.fn().mockImplementation((key: string) => {
        if (key === 'userId') return 'test-user-id';
        if (key === 'userRole') return 'CLIENT';
        return undefined;
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PrismaService,
        {
          provide: AppConfigService,
          useValue: {
            databaseUrl: 'postgresql://test:test@localhost:5432/test',
            isDatabaseConfigured: false,
          },
        },
        {
          provide: ClsService,
          useValue: mockCls,
        },
      ],
    }).compile();

    service = module.get<PrismaService>(PrismaService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('withUser', () => {
    it('should execute raw SET LOCAL with sanitized userId and role in transaction', async () => {
      const executeRawSpy = jest.fn().mockResolvedValue(1);
      const fakeTx = {
        $executeRawUnsafe: executeRawSpy,
      };

      jest.spyOn(service, '$transaction').mockImplementation(async (callback: any) => {
        return callback(fakeTx);
      });

      const result = await service.withUser('user-123', 'ARTISAN', async (tx) => {
        return 'success';
      });

      expect(result).toBe('success');
      expect(executeRawSpy).toHaveBeenCalledWith(
        "SET LOCAL app.current_user_id = 'user-123'; SET LOCAL app.current_user_role = 'ARTISAN';",
      );
    });

    it('should sanitize single quotes in userId to prevent SQL injection in session setting', async () => {
      const executeRawSpy = jest.fn().mockResolvedValue(1);
      const fakeTx = {
        $executeRawUnsafe: executeRawSpy,
      };

      jest.spyOn(service, '$transaction').mockImplementation(async (callback: any) => {
        return callback(fakeTx);
      });

      await service.withUser("user'--", 'CLIENT', async () => 'ok');

      expect(executeRawSpy).toHaveBeenCalledWith(
        "SET LOCAL app.current_user_id = 'user''--'; SET LOCAL app.current_user_role = 'CLIENT';",
      );
    });
  });

  describe('withBypassRls', () => {
    it('should execute SET LOCAL app.bypass_rls = on in transaction', async () => {
      const executeRawSpy = jest.fn().mockResolvedValue(1);
      const fakeTx = {
        $executeRawUnsafe: executeRawSpy,
      };

      jest.spyOn(service, '$transaction').mockImplementation(async (callback: any) => {
        return callback(fakeTx);
      });

      const result = await service.withBypassRls(async () => 'bypassed');

      expect(result).toBe('bypassed');
      expect(executeRawSpy).toHaveBeenCalledWith("SET LOCAL app.bypass_rls = 'on';");
    });
  });

  describe('runInTransaction', () => {
    it('should inject active CLS user context into transaction', async () => {
      const executeRawSpy = jest.fn().mockResolvedValue(1);
      const fakeTx = {
        $executeRawUnsafe: executeRawSpy,
      };

      jest.spyOn(service, '$transaction').mockImplementation(async (callback: any) => {
        return callback(fakeTx);
      });

      const result = await service.runInTransaction(async () => 'done');

      expect(result).toBe('done');
      expect(executeRawSpy).toHaveBeenCalledWith(
        "SET LOCAL app.current_user_id = 'test-user-id'; SET LOCAL app.current_user_role = 'CLIENT';",
      );
    });
  });
});
