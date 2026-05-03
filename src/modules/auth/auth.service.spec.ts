import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { UsersService } from '../users/users.service';
import { JwtService } from '@nestjs/jwt';
import { AccountLockoutService } from '../../common/services/account-lockout.service';
import { SessionService } from '../../common/services/session.service';
import { UnauthorizedException, ConflictException } from '@nestjs/common';
import { UserRole, UserStatus } from '../../generated/prisma';

describe('AuthService', () => {
  let service: AuthService;
  let usersService: UsersService;
  let jwtService: JwtService;
  let accountLockoutService: AccountLockoutService;
  let sessionService: SessionService;

  const mockUsersService = {
    findByEmail: jest.fn(),
    createUser: jest.fn(),
    sanitizeUser: jest.fn((user) => user),
    updateLastLoginAt: jest.fn(),
    findById: jest.fn(),
  };

  const mockJwtService = {
    signAsync: jest.fn().mockResolvedValue('test-token'),
    verifyAsync: jest.fn(),
  };

  const mockAccountLockoutService = {
    isLocked: jest.fn().mockResolvedValue({ locked: false }),
    recordFailedAttempt: jest.fn().mockResolvedValue({ locked: false }),
    recordSuccessfulAttempt: jest.fn(),
  };

  const mockSessionService = {
    createSession: jest.fn().mockResolvedValue('session-1'),
    createSessionToken: jest.fn().mockReturnValue('session-token'),
    detectSuspiciousActivity: jest.fn().mockResolvedValue({ isSuspicious: false }),
    validateSession: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: UsersService, useValue: mockUsersService },
        { provide: JwtService, useValue: mockJwtService },
        { provide: AccountLockoutService, useValue: mockAccountLockoutService },
        { provide: SessionService, useValue: mockSessionService },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    usersService = module.get<UsersService>(UsersService);
    jwtService = module.get<JwtService>(JwtService);
    accountLockoutService = module.get<AccountLockoutService>(AccountLockoutService);
    sessionService = module.get<SessionService>(SessionService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('register', () => {
    const registerDto = {
      email: 'test@example.com',
      password: 'Password123!',
      name: 'Tester',
      role: UserRole.CLIENT,
    };

    it('should successfully register a new user', async () => {
      mockUsersService.findByEmail.mockResolvedValue(null);
      mockUsersService.createUser.mockResolvedValue({
        id: 'user-1',
        ...registerDto,
      });

      const result = await service.register(registerDto);

      expect(result.message).toBe('Registration successful.');
      expect(result.data.accessToken).toBe('test-token');
      expect(usersService.createUser).toHaveBeenCalled();
    });

    it('should throw ConflictException if user already exists', async () => {
      mockUsersService.findByEmail.mockResolvedValue({ id: 'existing' });

      await expect(service.register(registerDto)).rejects.toThrow(ConflictException);
    });

    it('should prevent admin self-registration', async () => {
      const adminDto = { ...registerDto, role: UserRole.ADMIN };

      await expect(service.register(adminDto)).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('login', () => {
    const loginDto = { email: 'test@example.com', password: 'Password123!' };
    const mockUser = {
      id: 'user-1',
      email: loginDto.email,
      passwordHash: 'hashed-password',
      role: UserRole.CLIENT,
      status: UserStatus.ACTIVE,
    };

    it('should successfully login and return a session token', async () => {
      mockUsersService.findByEmail.mockResolvedValue(mockUser);
      // We need to mock compare from bcrypt which is used internally. 
      // But AuthService uses compare(dto.password, user.passwordHash) via private method.
      // For simplicity in this test, we can mock the private method or just rely on the fact 
      // that we are testing the service logic.
      // Since compare is imported directly, mocking it might require jest.mock('bcrypt').
      
      // Let's mock the private method for this unit test.
      (service as any).comparePassword = jest.fn().mockResolvedValue(true);
      mockUsersService.updateLastLoginAt.mockResolvedValue(mockUser);

      const result = await service.login(loginDto);

      expect(result.message).toBe('Login successful.');
      expect(result.data.accessToken).toBe('session-token');
      expect(accountLockoutService.recordSuccessfulAttempt).toHaveBeenCalled();
    });

    it('should throw UnauthorizedException for invalid password', async () => {
      mockUsersService.findByEmail.mockResolvedValue(mockUser);
      (service as any).comparePassword = jest.fn().mockResolvedValue(false);

      await expect(service.login(loginDto)).rejects.toThrow(UnauthorizedException);
      expect(accountLockoutService.recordFailedAttempt).toHaveBeenCalled();
    });

    it('should throw UnauthorizedException if account is locked', async () => {
      mockAccountLockoutService.isLocked.mockResolvedValue({ locked: true });
      (service as any).accountLockoutService.getLockoutRemainingTime = jest.fn().mockResolvedValue(30);

      await expect(service.login(loginDto)).rejects.toThrow(UnauthorizedException);
    });
  });
});
