import {
  ConflictException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { createHash, randomBytes } from 'node:crypto';
import { UserRole, UserStatus } from '../../generated/prisma';
import { UsersService } from '../users/users.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';

export type AuthenticatedUser = {
  sub: string;
  email: string;
  role: UserRole;
};

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
  ) {}

  async register(dto: RegisterDto) {
    this.ensureAllowedRole(dto.role);

    const existingUser = await this.usersService.findByEmail(dto.email);
    if (existingUser) {
      throw new ConflictException(
        `An account already exists for ${dto.email.toLowerCase()}.`,
      );
    }

    const passwordHash = await bcrypt.hash(dto.password, 10);
    const user = await this.usersService.createUser({
      name: dto.name,
      email: dto.email,
      passwordHash,
      role: dto.role,
    });

    const accessToken = await this.signAccessToken(user.id, user.email, user.role);

    return {
      message: 'Registration successful.',
      data: {
        user: this.usersService.sanitizeUser(user),
        accessToken,
      },
    };
  }

  async login(dto: LoginDto) {
    const user = await this.usersService.findByEmail(dto.email);
    if (!user) {
      throw new UnauthorizedException('Invalid email or password.');
    }

    const passwordValid = await this.comparePassword(dto.password, user.passwordHash);
    if (!passwordValid) {
      throw new UnauthorizedException('Invalid email or password.');
    }

    if (user.status === UserStatus.BANNED) {
      throw new UnauthorizedException('This account has been banned.');
    }

    const signedInUser = await this.usersService.updateLastLoginAt(
      user.id,
      new Date(),
    );
    const accessToken = await this.signAccessToken(user.id, user.email, user.role);

    return {
      message: 'Login successful.',
      data: {
        user: this.usersService.sanitizeUser(signedInUser),
        accessToken,
      },
    };
  }

  async verifyAccessToken(token: string): Promise<AuthenticatedUser> {
    try {
      const payload = await this.jwtService.verifyAsync<AuthenticatedUser>(token);
      const user = await this.usersService.findById(payload.sub);

      if (!user || user.status === UserStatus.BANNED) {
        throw new UnauthorizedException('User account is not available.');
      }

      return {
        sub: user.id,
        email: user.email,
        role: user.role,
      };
    } catch {
      throw new UnauthorizedException('Invalid or expired token.');
    }
  }

  async me(user: AuthenticatedUser) {
    const account = await this.usersService.findById(user.sub);
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

    return {
      message:
        'Password reset token generated. Deliver this token through your notification/email workflow.',
      data: {
        resetToken: rawToken,
        expiresAt: expiresAt.toISOString(),
      },
    };
  }

  async resetPassword(token: string, newPassword: string) {
    const tokenHash = this.hashResetToken(token);
    const user = await this.usersService.findByPasswordResetTokenHash(tokenHash);

    if (!user) {
      throw new NotFoundException('Reset token is invalid or has expired.');
    }

    const passwordHash = await bcrypt.hash(newPassword, 10);
    await this.usersService.updatePassword(user.id, passwordHash);

    return {
      message: 'Password reset successful.',
    };
  }

  async issueUserPasswordReset(userId: string, expiresInMinutes = 30) {
    const user = await this.usersService.findById(userId);
    if (!user) {
      throw new NotFoundException(`User ${userId} not found.`);
    }

    const { rawToken, tokenHash, expiresAt } = this.issuePasswordResetToken();
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

  private async signAccessToken(sub: string, email: string, role: UserRole) {
    return this.jwtService.signAsync({
      sub,
      email,
      role,
    });
  }

  private async comparePassword(password: string, passwordHash: string) {
    if (passwordHash.startsWith('hashed:')) {
      return passwordHash === `hashed:${password}`;
    }

    if (passwordHash.startsWith('temp:')) {
      return passwordHash === `temp:${password}`;
    }

    return bcrypt.compare(password, passwordHash);
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
