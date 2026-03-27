import { UserRole } from '../../generated/prisma';
import { PrismaService } from '../../database/prisma.service';
export declare class UsersService {
    private readonly prisma;
    constructor(prisma: PrismaService);
    findByEmail(email: string): import("../../generated/prisma").Prisma.Prisma__UserClient<{
        id: string;
        name: string;
        email: string;
        passwordHash: string;
        passwordResetTokenHash: string | null;
        passwordResetTokenExpiresAt: Date | null;
        passwordResetRequestedAt: Date | null;
        role: import("../../generated/prisma").$Enums.UserRole;
        status: import("../../generated/prisma").$Enums.UserStatus;
        artisanVerified: boolean;
        createdAt: Date;
        lastLoginAt: Date | null;
        updatedAt: Date;
    } | null, null, import("src/generated/prisma/runtime/client").DefaultArgs, import("../../generated/prisma").Prisma.PrismaClientOptions>;
    findById(id: string): import("../../generated/prisma").Prisma.Prisma__UserClient<{
        id: string;
        name: string;
        email: string;
        passwordHash: string;
        passwordResetTokenHash: string | null;
        passwordResetTokenExpiresAt: Date | null;
        passwordResetRequestedAt: Date | null;
        role: import("../../generated/prisma").$Enums.UserRole;
        status: import("../../generated/prisma").$Enums.UserStatus;
        artisanVerified: boolean;
        createdAt: Date;
        lastLoginAt: Date | null;
        updatedAt: Date;
    } | null, null, import("src/generated/prisma/runtime/client").DefaultArgs, import("../../generated/prisma").Prisma.PrismaClientOptions>;
    findByPasswordResetTokenHash(tokenHash: string): import("../../generated/prisma").Prisma.Prisma__UserClient<{
        id: string;
        name: string;
        email: string;
        passwordHash: string;
        passwordResetTokenHash: string | null;
        passwordResetTokenExpiresAt: Date | null;
        passwordResetRequestedAt: Date | null;
        role: import("../../generated/prisma").$Enums.UserRole;
        status: import("../../generated/prisma").$Enums.UserStatus;
        artisanVerified: boolean;
        createdAt: Date;
        lastLoginAt: Date | null;
        updatedAt: Date;
    } | null, null, import("src/generated/prisma/runtime/client").DefaultArgs, import("../../generated/prisma").Prisma.PrismaClientOptions>;
    createUser(input: {
        name: string;
        email: string;
        passwordHash: string;
        role: UserRole;
    }): import("../../generated/prisma").Prisma.Prisma__UserClient<{
        id: string;
        name: string;
        email: string;
        passwordHash: string;
        passwordResetTokenHash: string | null;
        passwordResetTokenExpiresAt: Date | null;
        passwordResetRequestedAt: Date | null;
        role: import("../../generated/prisma").$Enums.UserRole;
        status: import("../../generated/prisma").$Enums.UserStatus;
        artisanVerified: boolean;
        createdAt: Date;
        lastLoginAt: Date | null;
        updatedAt: Date;
    }, never, import("src/generated/prisma/runtime/client").DefaultArgs, import("../../generated/prisma").Prisma.PrismaClientOptions>;
    updateLastLoginAt(userId: string, timestamp: Date): import("../../generated/prisma").Prisma.Prisma__UserClient<{
        id: string;
        name: string;
        email: string;
        passwordHash: string;
        passwordResetTokenHash: string | null;
        passwordResetTokenExpiresAt: Date | null;
        passwordResetRequestedAt: Date | null;
        role: import("../../generated/prisma").$Enums.UserRole;
        status: import("../../generated/prisma").$Enums.UserStatus;
        artisanVerified: boolean;
        createdAt: Date;
        lastLoginAt: Date | null;
        updatedAt: Date;
    }, never, import("src/generated/prisma/runtime/client").DefaultArgs, import("../../generated/prisma").Prisma.PrismaClientOptions>;
    storePasswordResetToken(input: {
        userId: string;
        tokenHash: string;
        expiresAt: Date;
        requestedAt: Date;
    }): import("../../generated/prisma").Prisma.Prisma__UserClient<{
        id: string;
        name: string;
        email: string;
        passwordHash: string;
        passwordResetTokenHash: string | null;
        passwordResetTokenExpiresAt: Date | null;
        passwordResetRequestedAt: Date | null;
        role: import("../../generated/prisma").$Enums.UserRole;
        status: import("../../generated/prisma").$Enums.UserStatus;
        artisanVerified: boolean;
        createdAt: Date;
        lastLoginAt: Date | null;
        updatedAt: Date;
    }, never, import("src/generated/prisma/runtime/client").DefaultArgs, import("../../generated/prisma").Prisma.PrismaClientOptions>;
    updatePassword(userId: string, passwordHash: string): import("../../generated/prisma").Prisma.Prisma__UserClient<{
        id: string;
        name: string;
        email: string;
        passwordHash: string;
        passwordResetTokenHash: string | null;
        passwordResetTokenExpiresAt: Date | null;
        passwordResetRequestedAt: Date | null;
        role: import("../../generated/prisma").$Enums.UserRole;
        status: import("../../generated/prisma").$Enums.UserStatus;
        artisanVerified: boolean;
        createdAt: Date;
        lastLoginAt: Date | null;
        updatedAt: Date;
    }, never, import("src/generated/prisma/runtime/client").DefaultArgs, import("../../generated/prisma").Prisma.PrismaClientOptions>;
    sanitizeUser<T extends {
        passwordHash: string;
        createdAt: Date;
        updatedAt: Date;
        lastLoginAt: Date | null;
        passwordResetTokenHash: string | null;
        passwordResetTokenExpiresAt: Date | null;
        passwordResetRequestedAt: Date | null;
    }>(user: T): Omit<Omit<T, "passwordHash">, "passwordResetTokenHash" | "passwordResetTokenExpiresAt" | "passwordResetRequestedAt"> & {
        createdAt: string;
        updatedAt: string;
        lastLoginAt: string | null;
    };
}
