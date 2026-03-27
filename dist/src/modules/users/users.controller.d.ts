import { UsersService } from './users.service';
import { UpdateUserProfileDto } from './dto/update-user-profile.dto';
import { $Enums } from '../../generated/prisma';
import { PrismaService } from '../../database/prisma.service';
export declare class UsersController {
    private readonly usersService;
    private readonly prisma;
    constructor(usersService: UsersService, prisma: PrismaService);
    getCurrentUser(user: {
        id: string;
        role: $Enums.UserRole;
    }): Promise<Omit<Omit<{
        artisanProfile: {
            updatedAt: Date;
            id: string;
            createdAt: Date;
            rating: number | null;
            userId: string;
            bio: string | null;
            skills: import("src/generated/prisma/runtime/client").JsonValue;
            experience: string | null;
            portfolio: import("src/generated/prisma/runtime/client").JsonValue;
            verified: boolean;
            reviewCount: number;
        } | null;
    } & {
        updatedAt: Date;
        name: string;
        id: string;
        email: string;
        passwordHash: string;
        passwordResetTokenHash: string | null;
        passwordResetTokenExpiresAt: Date | null;
        passwordResetRequestedAt: Date | null;
        role: $Enums.UserRole;
        status: $Enums.UserStatus;
        artisanVerified: boolean;
        createdAt: Date;
        lastLoginAt: Date | null;
    }, "passwordHash">, "passwordResetTokenHash" | "passwordResetTokenExpiresAt" | "passwordResetRequestedAt"> & {
        createdAt: string;
        updatedAt: string;
        lastLoginAt: string | null;
    }>;
    updateCurrentUser(user: {
        id: string;
        role: $Enums.UserRole;
    }, updateDto: UpdateUserProfileDto): Promise<Omit<Omit<{
        updatedAt: Date;
        name: string;
        id: string;
        email: string;
        passwordHash: string;
        passwordResetTokenHash: string | null;
        passwordResetTokenExpiresAt: Date | null;
        passwordResetRequestedAt: Date | null;
        role: $Enums.UserRole;
        status: $Enums.UserStatus;
        artisanVerified: boolean;
        createdAt: Date;
        lastLoginAt: Date | null;
    }, "passwordHash">, "passwordResetTokenHash" | "passwordResetTokenExpiresAt" | "passwordResetRequestedAt"> & {
        createdAt: string;
        updatedAt: string;
        lastLoginAt: string | null;
    }>;
    getUserById(id: string): Promise<Omit<Omit<{
        artisanProfile: {
            updatedAt: Date;
            id: string;
            createdAt: Date;
            rating: number | null;
            userId: string;
            bio: string | null;
            skills: import("src/generated/prisma/runtime/client").JsonValue;
            experience: string | null;
            portfolio: import("src/generated/prisma/runtime/client").JsonValue;
            verified: boolean;
            reviewCount: number;
        } | null;
    } & {
        updatedAt: Date;
        name: string;
        id: string;
        email: string;
        passwordHash: string;
        passwordResetTokenHash: string | null;
        passwordResetTokenExpiresAt: Date | null;
        passwordResetRequestedAt: Date | null;
        role: $Enums.UserRole;
        status: $Enums.UserStatus;
        artisanVerified: boolean;
        createdAt: Date;
        lastLoginAt: Date | null;
    }, "passwordHash">, "passwordResetTokenHash" | "passwordResetTokenExpiresAt" | "passwordResetRequestedAt"> & {
        createdAt: string;
        updatedAt: string;
        lastLoginAt: string | null;
    }>;
}
