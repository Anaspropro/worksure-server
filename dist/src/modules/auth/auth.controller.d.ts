import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { AuthService, AuthenticatedUser } from './auth.service';
export declare class AuthController {
    private readonly authService;
    constructor(authService: AuthService);
    register(dto: RegisterDto): Promise<{
        message: string;
        data: {
            user: Omit<Omit<{
                updatedAt: Date;
                name: string;
                id: string;
                email: string;
                passwordHash: string;
                passwordResetTokenHash: string | null;
                passwordResetTokenExpiresAt: Date | null;
                passwordResetRequestedAt: Date | null;
                role: import("src/generated/prisma").$Enums.UserRole;
                status: import("src/generated/prisma").$Enums.UserStatus;
                artisanVerified: boolean;
                createdAt: Date;
                lastLoginAt: Date | null;
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
                updatedAt: Date;
                name: string;
                id: string;
                email: string;
                passwordHash: string;
                passwordResetTokenHash: string | null;
                passwordResetTokenExpiresAt: Date | null;
                passwordResetRequestedAt: Date | null;
                role: import("src/generated/prisma").$Enums.UserRole;
                status: import("src/generated/prisma").$Enums.UserStatus;
                artisanVerified: boolean;
                createdAt: Date;
                lastLoginAt: Date | null;
            }, "passwordHash">, "passwordResetTokenHash" | "passwordResetTokenExpiresAt" | "passwordResetRequestedAt"> & {
                createdAt: string;
                updatedAt: string;
                lastLoginAt: string | null;
            };
            accessToken: string;
        };
    }>;
    forgotPassword(dto: ForgotPasswordDto): Promise<{
        message: string;
        data?: undefined;
    } | {
        message: string;
        data: {
            resetToken: string;
            expiresAt: string;
        };
    }>;
    resetPassword(dto: ResetPasswordDto): Promise<{
        message: string;
    }>;
    me(user: AuthenticatedUser): Promise<{
        data: Omit<Omit<{
            updatedAt: Date;
            name: string;
            id: string;
            email: string;
            passwordHash: string;
            passwordResetTokenHash: string | null;
            passwordResetTokenExpiresAt: Date | null;
            passwordResetRequestedAt: Date | null;
            role: import("src/generated/prisma").$Enums.UserRole;
            status: import("src/generated/prisma").$Enums.UserStatus;
            artisanVerified: boolean;
            createdAt: Date;
            lastLoginAt: Date | null;
        }, "passwordHash">, "passwordResetTokenHash" | "passwordResetTokenExpiresAt" | "passwordResetRequestedAt"> & {
            createdAt: string;
            updatedAt: string;
            lastLoginAt: string | null;
        };
    }>;
}
