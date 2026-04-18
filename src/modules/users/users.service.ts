import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { UserRole, UserStatus } from '../../generated/prisma';
import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  findByEmail(email: string) {
    return this.prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });
  }

  findById(id: string) {
    return this.prisma.user.findUnique({
      where: { id },
    });
  }

  findByPasswordResetTokenHash(tokenHash: string) {
    return this.prisma.user.findFirst({
      where: {
        passwordResetTokenHash: tokenHash,
        passwordResetTokenExpiresAt: {
          gt: new Date(),
        },
      },
    });
  }

  createUser(input: {
    name: string;
    email: string;
    passwordHash: string;
    role: UserRole;
  }) {
    return this.prisma.user.create({
      data: {
        id: randomUUID(),
        name: input.name.trim(),
        email: input.email.toLowerCase().trim(),
        passwordHash: input.passwordHash,
        role: input.role,
        status: UserStatus.ACTIVE,
        artisanVerified: false,
        createdAt: new Date(),
      },
    });
  }

  updateLastLoginAt(userId: string, timestamp: Date) {
    return this.prisma.user.update({
      where: { id: userId },
      data: { lastLoginAt: timestamp },
    });
  }

  storePasswordResetToken(input: {
    userId: string;
    tokenHash: string;
    expiresAt: Date;
    requestedAt: Date;
  }) {
    return this.prisma.user.update({
      where: { id: input.userId },
      data: {
        passwordResetTokenHash: input.tokenHash,
        passwordResetTokenExpiresAt: input.expiresAt,
        passwordResetRequestedAt: input.requestedAt,
      },
    });
  }

  updatePassword(userId: string, passwordHash: string) {
    return this.prisma.user.update({
      where: { id: userId },
      data: {
        passwordHash,
        passwordResetTokenHash: null,
        passwordResetTokenExpiresAt: null,
        passwordResetRequestedAt: null,
      },
    });
  }

  sanitizeUser<
    T extends {
      passwordHash: string;
      createdAt: Date;
      updatedAt: Date;
      lastLoginAt: Date | null;
      passwordResetTokenHash: string | null;
      passwordResetTokenExpiresAt: Date | null;
      passwordResetRequestedAt: Date | null;
    },
  >(user: T) {
    const {
      passwordHash,
      passwordResetTokenHash,
      passwordResetTokenExpiresAt,
      passwordResetRequestedAt,
      ...safeUser
    } = user;
    void passwordHash;
    void passwordResetTokenHash;
    void passwordResetTokenExpiresAt;
    void passwordResetRequestedAt;

    return {
      ...safeUser,
      createdAt: safeUser.createdAt.toISOString(),
      updatedAt: safeUser.updatedAt.toISOString(),
      lastLoginAt: safeUser.lastLoginAt?.toISOString() ?? null,
    };
  }
}
