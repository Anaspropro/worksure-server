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
exports.UsersService = void 0;
const common_1 = require("@nestjs/common");
const node_crypto_1 = require("node:crypto");
const prisma_1 = require("../../generated/prisma");
const prisma_service_1 = require("../../database/prisma.service");
let UsersService = class UsersService {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    findByEmail(email) {
        return this.prisma.user.findUnique({
            where: { email: email.toLowerCase() },
        });
    }
    findById(id) {
        return this.prisma.user.findUnique({
            where: { id },
        });
    }
    findByPasswordResetTokenHash(tokenHash) {
        return this.prisma.user.findFirst({
            where: {
                passwordResetTokenHash: tokenHash,
                passwordResetTokenExpiresAt: {
                    gt: new Date(),
                },
            },
        });
    }
    createUser(input) {
        return this.prisma.user.create({
            data: {
                id: (0, node_crypto_1.randomUUID)(),
                name: input.name.trim(),
                email: input.email.toLowerCase().trim(),
                passwordHash: input.passwordHash,
                role: input.role,
                status: prisma_1.UserStatus.ACTIVE,
                artisanVerified: false,
                createdAt: new Date(),
            },
        });
    }
    updateLastLoginAt(userId, timestamp) {
        return this.prisma.user.update({
            where: { id: userId },
            data: { lastLoginAt: timestamp },
        });
    }
    storePasswordResetToken(input) {
        return this.prisma.user.update({
            where: { id: input.userId },
            data: {
                passwordResetTokenHash: input.tokenHash,
                passwordResetTokenExpiresAt: input.expiresAt,
                passwordResetRequestedAt: input.requestedAt,
            },
        });
    }
    updatePassword(userId, passwordHash) {
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
    sanitizeUser(user) {
        const { passwordHash, ...safeUser } = user;
        const { passwordResetTokenHash, passwordResetTokenExpiresAt, passwordResetRequestedAt, ...rest } = safeUser;
        return {
            ...rest,
            createdAt: rest.createdAt.toISOString(),
            updatedAt: rest.updatedAt.toISOString(),
            lastLoginAt: rest.lastLoginAt?.toISOString() ?? null,
        };
    }
};
exports.UsersService = UsersService;
exports.UsersService = UsersService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], UsersService);
//# sourceMappingURL=users.service.js.map