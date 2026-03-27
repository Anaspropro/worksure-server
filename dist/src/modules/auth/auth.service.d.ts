import { JwtService } from '@nestjs/jwt';
import { UserRole } from '../../generated/prisma';
import { UsersService } from '../users/users.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
export type AuthenticatedUser = {
    sub: string;
    email: string;
    role: UserRole;
};
export declare class AuthService {
    private readonly usersService;
    private readonly jwtService;
    constructor(usersService: UsersService, jwtService: JwtService);
    register(dto: RegisterDto): Promise<{
        message: string;
        data: {
            user: Omit<Omit<{
                name: string;
                id: string;
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
            }, "passwordHash">, "passwordResetTokenHash" | "passwordResetTokenExpiresAt" | "passwordResetRequestedAt"> & {
                createdAt: string;
                updatedAt: string;
                lastLoginAt: string | null;
            };
            accessToken: string;
        };
    }>;
    login(dto: LoginDto): Promise<{
        message: string;
        data: {
            user: Omit<Omit<{
                name: string;
                id: string;
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
            }, "passwordHash">, "passwordResetTokenHash" | "passwordResetTokenExpiresAt" | "passwordResetRequestedAt"> & {
                createdAt: string;
                updatedAt: string;
                lastLoginAt: string | null;
            };
            accessToken: string;
        };
    }>;
    verifyAccessToken(token: string): Promise<AuthenticatedUser>;
    me(user: AuthenticatedUser): Promise<{
        data: Omit<Omit<{
            name: string;
            id: string;
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
        }, "passwordHash">, "passwordResetTokenHash" | "passwordResetTokenExpiresAt" | "passwordResetRequestedAt"> & {
            createdAt: string;
            updatedAt: string;
            lastLoginAt: string | null;
        };
    }>;
    requestPasswordReset(email: string): Promise<{
        message: string;
        data?: undefined;
    } | {
        message: string;
        data: {
            resetToken: string;
            expiresAt: string;
        };
    }>;
    resetPassword(token: string, newPassword: string): Promise<{
        message: string;
    }>;
    issueUserPasswordReset(userId: string, expiresInMinutes?: number): Promise<{
        resetToken: string;
        expiresAt: Date;
    }>;
    private ensureAllowedRole;
    private signAccessToken;
    private comparePassword;
    private issuePasswordResetToken;
    private hashResetToken;
}
