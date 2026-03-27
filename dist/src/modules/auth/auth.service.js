"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthService = void 0;
const common_1 = require("@nestjs/common");
const jwt_1 = require("@nestjs/jwt");
const bcrypt = require("bcrypt");
const node_crypto_1 = require("node:crypto");
const prisma_1 = require("../../generated/prisma");
const users_service_1 = require("../users/users.service");
let AuthService = class AuthService {
    usersService;
    jwtService;
    constructor(usersService, jwtService) {
        this.usersService = usersService;
        this.jwtService = jwtService;
    }
    async register(dto) {
        this.ensureAllowedRole(dto.role);
        const existingUser = await this.usersService.findByEmail(dto.email);
        if (existingUser) {
            throw new common_1.ConflictException(`An account already exists for ${dto.email.toLowerCase()}.`);
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
    async login(dto) {
        const user = await this.usersService.findByEmail(dto.email);
        if (!user) {
            throw new common_1.UnauthorizedException('Invalid email or password.');
        }
        const passwordValid = await this.comparePassword(dto.password, user.passwordHash);
        if (!passwordValid) {
            throw new common_1.UnauthorizedException('Invalid email or password.');
        }
        if (user.status === prisma_1.UserStatus.BANNED) {
            throw new common_1.UnauthorizedException('This account has been banned.');
        }
        const signedInUser = await this.usersService.updateLastLoginAt(user.id, new Date());
        const accessToken = await this.signAccessToken(user.id, user.email, user.role);
        return {
            message: 'Login successful.',
            data: {
                user: this.usersService.sanitizeUser(signedInUser),
                accessToken,
            },
        };
    }
    async verifyAccessToken(token) {
        try {
            const payload = await this.jwtService.verifyAsync(token);
            const user = await this.usersService.findById(payload.sub);
            if (!user || user.status === prisma_1.UserStatus.BANNED) {
                throw new common_1.UnauthorizedException('User account is not available.');
            }
            return {
                sub: user.id,
                email: user.email,
                role: user.role,
            };
        }
        catch {
            throw new common_1.UnauthorizedException('Invalid or expired token.');
        }
    }
    async me(user) {
        const account = await this.usersService.findById(user.sub);
        if (!account) {
            throw new common_1.UnauthorizedException('User account no longer exists.');
        }
        return {
            data: this.usersService.sanitizeUser(account),
        };
    }
    async requestPasswordReset(email) {
        const user = await this.usersService.findByEmail(email);
        if (!user) {
            return {
                message: 'If an account exists for that email, a password reset token has been issued.',
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
            message: 'Password reset token generated. Deliver this token through your notification/email workflow.',
            data: {
                resetToken: rawToken,
                expiresAt: expiresAt.toISOString(),
            },
        };
    }
    async resetPassword(token, newPassword) {
        const tokenHash = this.hashResetToken(token);
        const user = await this.usersService.findByPasswordResetTokenHash(tokenHash);
        if (!user) {
            throw new common_1.NotFoundException('Reset token is invalid or has expired.');
        }
        const passwordHash = await bcrypt.hash(newPassword, 10);
        await this.usersService.updatePassword(user.id, passwordHash);
        return {
            message: 'Password reset successful.',
        };
    }
    async issueUserPasswordReset(userId, expiresInMinutes = 30) {
        const user = await this.usersService.findById(userId);
        if (!user) {
            throw new common_1.NotFoundException(`User ${userId} not found.`);
        }
        const { rawToken, tokenHash, expiresAt } = this.issuePasswordResetToken();
        const requestedAt = new Date();
        const adjustedExpiresAt = new Date(requestedAt.getTime() + expiresInMinutes * 60 * 1000);
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
    ensureAllowedRole(role) {
        if (role === prisma_1.UserRole.ADMIN) {
            throw new common_1.UnauthorizedException('Admin accounts cannot self-register.');
        }
    }
    async signAccessToken(sub, email, role) {
        return this.jwtService.signAsync({
            sub,
            email,
            role,
        });
    }
    async comparePassword(password, passwordHash) {
        if (passwordHash.startsWith('hashed:')) {
            return passwordHash === `hashed:${password}`;
        }
        if (passwordHash.startsWith('temp:')) {
            return passwordHash === `temp:${password}`;
        }
        return bcrypt.compare(password, passwordHash);
    }
    issuePasswordResetToken() {
        const rawToken = (0, node_crypto_1.randomBytes)(32).toString('hex');
        const tokenHash = this.hashResetToken(rawToken);
        const expiresAt = new Date(Date.now() + 1000 * 60 * 30);
        return {
            rawToken,
            tokenHash,
            expiresAt,
        };
    }
    hashResetToken(token) {
        return (0, node_crypto_1.createHash)('sha256').update(token).digest('hex');
    }
};
exports.AuthService = AuthService;
exports.AuthService = AuthService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [users_service_1.UsersService,
        jwt_1.JwtService])
], AuthService);
//# sourceMappingURL=auth.service.js.map