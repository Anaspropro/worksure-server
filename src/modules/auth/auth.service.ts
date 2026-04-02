import {
  ConflictException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { compare, hash } from 'bcrypt';
import { createHash, randomBytes } from 'node:crypto';
import { UserRole, UserStatus, type User } from '../../generated/prisma';
import { UsersService } from '../users/users.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { AccountLockoutService } from '../../common/services/account-lockout.service';
import { SessionService } from '../../common/services/session.service';

export type AuthenticatedUser = {
  id: string;
  sub: string;
  email: string;
  role: UserRole;
  sessionId: string;
};

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly accountLockoutService: AccountLockoutService,
    private readonly sessionService: SessionService,
  ) {}

  async register(dto: RegisterDto, ipAddress?: string, userAgent?: string) {
    this.ensureAllowedRole(dto.role);

    const existingUser = await this.usersService.findByEmail(dto.email);
    if (existingUser) {
      throw new ConflictException(
        `An account already exists for ${dto.email.toLowerCase()}.`,
      );
    }

    const passwordHash = await hash(dto.password, 10);
    const user = await this.usersService.createUser({
      name: dto.name,
      email: dto.email,
      passwordHash,
      role: dto.role,
    });

    const sessionId = this.sessionService.createSession(
      user.id,
      user.email,
      user.role,
      ipAddress || 'unknown',
      userAgent || 'unknown',
    );

    const accessToken = await this.signAccessToken({
      userId: user.id,
      email: user.email,
      role: user.role,
      sessionId,
    });

    return {
      message: 'Registration successful.',
      data: {
        user: this.usersService.sanitizeUser(user),
        accessToken,
        sessionId,
      },
    };
  }

  async login(dto: LoginDto, ipAddress?: string, userAgent?: string) {
    // Check if account is locked
    const lockoutStatus = this.accountLockoutService.isLocked(dto.email);
    if (lockoutStatus.locked) {
      const remainingTime = this.accountLockoutService.getLockoutRemainingTime(
        dto.email,
      );
      throw new UnauthorizedException(
        `Account is temporarily locked. Try again in ${remainingTime} seconds.`,
      );
    }

    const user = await this.usersService.findByEmail(dto.email);
    if (!user) {
      // Record failed attempt for non-existent email to prevent enumeration
      this.accountLockoutService.recordFailedAttempt(dto.email);
      throw new UnauthorizedException('Invalid email or password.');
    }

    const passwordValid = await this.comparePassword(
      dto.password,
      user.passwordHash,
    );
    if (!passwordValid) {
      const attemptResult = this.accountLockoutService.recordFailedAttempt(
        dto.email,
      );
      if (attemptResult.locked) {
        const remainingTime = Math.ceil(
          (attemptResult.lockoutExpires! - Date.now()) / 1000,
        );
        throw new UnauthorizedException(
          `Too many failed login attempts. Account locked for ${remainingTime} seconds.`,
        );
      }
      throw new UnauthorizedException('Invalid email or password.');
    }

    if (user.status === UserStatus.BANNED) {
      throw new UnauthorizedException('This account has been banned.');
    }

    // Record successful attempt and clear failed attempts
    this.accountLockoutService.recordSuccessfulAttempt(dto.email);

    // Create session
    const sessionId = this.sessionService.createSession(
      user.id,
      user.email,
      user.role,
      ipAddress || 'unknown',
      userAgent || 'unknown',
    );

    // Check for suspicious activity
    const suspiciousActivity = this.sessionService.detectSuspiciousActivity(
      user.id,
    );
    if (suspiciousActivity.isSuspicious) {
      // Log suspicious activity but don't block login
      console.warn(
        `Suspicious activity detected for user ${user.id}:`,
        suspiciousActivity.reasons,
      );
    }

    const signedInUser = await this.usersService.updateLastLoginAt(
      user.id,
      new Date(),
    );

    // Create token with session ID
    const sessionToken = this.sessionService.createSessionToken({
      userId: user.id,
      email: user.email,
      role: user.role,
      loginTime: Date.now(),
      lastActivity: Date.now(),
      ipAddress: ipAddress || 'unknown',
      userAgent: userAgent || 'unknown',
      sessionId,
    });

    return {
      message: 'Login successful.',
      data: {
        user: this.usersService.sanitizeUser(signedInUser),
        accessToken: sessionToken,
        sessionId,
      },
    };
  }

  async verifyAccessToken(token: string): Promise<AuthenticatedUser> {
    try {
      const payload = await this.jwtService.verifyAsync<{
        sub: string;
        email: string;
        role: UserRole;
        sessionId?: string;
      }>(token);

      if (!payload.sessionId) {
        throw new UnauthorizedException('Session is invalid.');
      }

      const session = this.sessionService.validateSession(payload.sessionId);
      if (!session || session.userId !== payload.sub) {
        throw new UnauthorizedException('Session is invalid.');
      }

      const user = await this.usersService.findById(payload.sub);

      if (!user || user.status === UserStatus.BANNED) {
        throw new UnauthorizedException(
          'User account is not available or banned.',
        );
      }

      return {
        id: user.id,
        sub: user.id,
        email: user.email,
        role: user.role,
        sessionId: payload.sessionId,
      };
    } catch (error: unknown) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }

      const message =
        error instanceof Error ? error.message : 'Invalid or expired token.';
      throw new UnauthorizedException(
        message.includes('expired') ? 'Token has expired.' : 'Invalid token.',
      );
    }
  }

  async me(user: AuthenticatedUser) {
    const account = await this.usersService.findById(user.id);
    if (!account) {
      throw new UnauthorizedException('User account no longer exists.');
    }

    return {
      data: this.usersService.sanitizeUser(account),
    };
  }

  async requestPasswordReset(email: string) {
    const user = await this.usersService.findByEmail(email);

    if (!user) {
      return {
        message:
          'If an account exists for that email, a password reset token has been issued.',
      };
    }

    const { rawToken, tokenHash, expiresAt } = this.issuePasswordResetToken();
    await this.usersService.storePasswordResetToken({
      userId: user.id,
      tokenHash,
      expiresAt,
      requestedAt: new Date(),
    });

    const response: {
      message: string;
      data?: {
        resetToken: string;
      };
    } = {
      message:
        'Password reset token generated. Deliver this token through your notification/email workflow.',
    };

    if (process.env.NODE_ENV === 'test') {
      response.data = {
        resetToken: rawToken,
      };
    }

    return response;
  }

  async resetPassword(token: string, newPassword: string) {
    const tokenHash = this.hashResetToken(token);
    const user: User | null =
      await this.usersService.findByPasswordResetTokenHash(tokenHash);

    if (!user) {
      throw new NotFoundException('Reset token is invalid or has expired.');
    }

    const passwordHash: string = await hash(newPassword, 10);
    await this.usersService.updatePassword(user.id, passwordHash);
    this.sessionService.invalidateUserSessions(user.id);

    return {
      message: 'Password reset successful.',
    };
  }

  logout(user: AuthenticatedUser) {
    this.sessionService.invalidateSession(user.sessionId);

    return {
      message: 'Logout successful.',
    };
  }

  async issueUserPasswordReset(userId: string, expiresInMinutes = 30) {
    const user = await this.usersService.findById(userId);
    if (!user) {
      throw new NotFoundException(`User ${userId} not found.`);
    }

    const { rawToken, tokenHash } = this.issuePasswordResetToken();
    const requestedAt = new Date();
    const adjustedExpiresAt = new Date(
      requestedAt.getTime() + expiresInMinutes * 60 * 1000,
    );

    await this.usersService.storePasswordResetToken({
      userId: user.id,
      tokenHash,
      expiresAt: adjustedExpiresAt,
      requestedAt,
    });

    return {
      resetToken: rawToken,
      expiresAt: adjustedExpiresAt,
    };
  }

  private ensureAllowedRole(role: UserRole) {
    if (role === UserRole.ADMIN) {
      throw new UnauthorizedException('Admin accounts cannot self-register.');
    }
  }

  private async signAccessToken(input: {
    userId: string;
    email: string;
    role: UserRole;
    sessionId: string;
  }) {
    return this.jwtService.signAsync({
      sub: input.userId,
      email: input.email,
      role: input.role,
      sessionId: input.sessionId,
    });
  }

  private comparePassword(password: string, passwordHash: string) {
    return compare(password, passwordHash);
  }

  private issuePasswordResetToken() {
    const rawToken = randomBytes(32).toString('hex');
    const tokenHash = this.hashResetToken(rawToken);
    const expiresAt = new Date(Date.now() + 1000 * 60 * 30);

    return {
      rawToken,
      tokenHash,
      expiresAt,
    };
  }

  private hashResetToken(token: string) {
    return createHash('sha256').update(token).digest('hex');
  }
}
