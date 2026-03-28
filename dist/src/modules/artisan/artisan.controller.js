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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ArtisanController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const current_user_decorator_1 = require("../../common/decorators/current-user.decorator");
const roles_decorator_1 = require("../../common/decorators/roles.decorator");
const jwt_auth_guard_1 = require("../auth/guards/jwt-auth.guard");
const roles_guard_1 = require("../../common/guards/roles.guard");
const prisma_1 = require("../../generated/prisma");
const prisma_service_1 = require("../../database/prisma.service");
const roles_constants_1 = require("../../common/constants/roles.constants");
const node_crypto_1 = require("node:crypto");
const create_artisan_profile_dto_1 = require("./dto/create-artisan-profile.dto");
let ArtisanController = class ArtisanController {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    ensureArtisanRole(user) {
        if (user.role !== prisma_1.$Enums.UserRole.ARTISAN) {
            throw new common_1.ForbiddenException('Artisan access required');
        }
    }
    async createArtisanProfile(user, createDto) {
        this.ensureArtisanRole(user);
        const existingProfile = await this.prisma.artisanProfile.findUnique({
            where: { userId: user.id },
        });
        if (existingProfile) {
            throw new common_1.ConflictException('Artisan profile already exists');
        }
        const profile = await this.prisma.artisanProfile.create({
            data: {
                id: (0, node_crypto_1.randomUUID)(),
                userId: user.id,
                bio: createDto.bio || null,
                skills: JSON.stringify(createDto.skills || []),
                experience: createDto.experience || null,
                portfolio: JSON.stringify(createDto.portfolio || []),
            },
            include: {
                user: {
                    select: {
                        id: true,
                        name: true,
                        email: true,
                    },
                },
            },
        });
        return {
            ...profile,
            createdAt: profile.createdAt.toISOString(),
            updatedAt: profile.updatedAt.toISOString(),
        };
    }
    async getCurrentArtisanProfile(user) {
        this.ensureArtisanRole(user);
        const profile = await this.prisma.artisanProfile.findUnique({
            where: { userId: user.id },
            include: {
                user: {
                    select: {
                        id: true,
                        name: true,
                        email: true,
                    },
                },
            },
        });
        if (!profile) {
            throw new common_1.NotFoundException('Artisan profile not found');
        }
        return {
            ...profile,
            createdAt: profile.createdAt.toISOString(),
            updatedAt: profile.updatedAt.toISOString(),
        };
    }
    async updateArtisanProfile(user, updateDto) {
        this.ensureArtisanRole(user);
        const existingProfile = await this.prisma.artisanProfile.findUnique({
            where: { userId: user.id },
        });
        if (!existingProfile) {
            throw new common_1.NotFoundException('Artisan profile not found');
        }
        const updateData = {};
        if (updateDto.bio !== undefined)
            updateData.bio = updateDto.bio;
        if (updateDto.skills !== undefined)
            updateData.skills = JSON.stringify(updateDto.skills);
        if (updateDto.experience !== undefined)
            updateData.experience = updateDto.experience;
        if (updateDto.portfolio !== undefined)
            updateData.portfolio = JSON.stringify(updateDto.portfolio);
        const profile = await this.prisma.artisanProfile.update({
            where: { userId: user.id },
            data: updateData,
            include: {
                user: {
                    select: {
                        id: true,
                        name: true,
                        email: true,
                    },
                },
            },
        });
        return {
            ...profile,
            createdAt: profile.createdAt.toISOString(),
            updatedAt: profile.updatedAt.toISOString(),
        };
    }
    async getArtisanProfileByUserId(userId) {
        const profile = await this.prisma.artisanProfile.findUnique({
            where: { userId },
            include: {
                user: {
                    select: {
                        id: true,
                        name: true,
                        email: true,
                    },
                },
            },
        });
        if (!profile) {
            throw new common_1.NotFoundException('Artisan profile not found');
        }
        return {
            ...profile,
            createdAt: profile.createdAt.toISOString(),
            updatedAt: profile.updatedAt.toISOString(),
        };
    }
};
exports.ArtisanController = ArtisanController;
__decorate([
    (0, swagger_1.ApiBearerAuth)('bearer'),
    (0, swagger_1.ApiOperation)({ summary: 'Create artisan profile' }),
    (0, swagger_1.ApiCreatedResponse)({ description: 'Artisan profile created successfully.' }),
    (0, swagger_1.ApiForbiddenResponse)({ description: 'Artisan access required.' }),
    (0, swagger_1.ApiConflictResponse)({ description: 'Artisan profile already exists.' }),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard),
    (0, roles_decorator_1.Roles)(roles_constants_1.UserRole.ARTISAN),
    (0, common_1.Post)('profile'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, create_artisan_profile_dto_1.CreateArtisanProfileDto]),
    __metadata("design:returntype", Promise)
], ArtisanController.prototype, "createArtisanProfile", null);
__decorate([
    (0, swagger_1.ApiBearerAuth)('bearer'),
    (0, swagger_1.ApiOperation)({ summary: 'Get current artisan profile' }),
    (0, swagger_1.ApiOkResponse)({ description: 'Artisan profile returned successfully.' }),
    (0, swagger_1.ApiNotFoundResponse)({ description: 'Artisan profile not found.' }),
    (0, swagger_1.ApiForbiddenResponse)({ description: 'Artisan access required.' }),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard),
    (0, roles_decorator_1.Roles)(roles_constants_1.UserRole.ARTISAN),
    (0, common_1.Get)('profile/me'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], ArtisanController.prototype, "getCurrentArtisanProfile", null);
__decorate([
    (0, swagger_1.ApiBearerAuth)('bearer'),
    (0, swagger_1.ApiOperation)({ summary: 'Update artisan profile' }),
    (0, swagger_1.ApiOkResponse)({ description: 'Artisan profile updated successfully.' }),
    (0, swagger_1.ApiNotFoundResponse)({ description: 'Artisan profile not found.' }),
    (0, swagger_1.ApiForbiddenResponse)({ description: 'Artisan access required.' }),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard),
    (0, roles_decorator_1.Roles)(roles_constants_1.UserRole.ARTISAN),
    (0, common_1.Patch)('profile'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, create_artisan_profile_dto_1.UpdateArtisanProfileDto]),
    __metadata("design:returntype", Promise)
], ArtisanController.prototype, "updateArtisanProfile", null);
__decorate([
    (0, swagger_1.ApiOperation)({ summary: 'Get artisan profile by user ID' }),
    (0, swagger_1.ApiOkResponse)({ description: 'Artisan profile returned successfully.' }),
    (0, swagger_1.ApiNotFoundResponse)({ description: 'Artisan profile not found.' }),
    (0, common_1.Get)(':userId'),
    __param(0, (0, common_1.Param)('userId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], ArtisanController.prototype, "getArtisanProfileByUserId", null);
exports.ArtisanController = ArtisanController = __decorate([
    (0, swagger_1.ApiTags)('artisan'),
    (0, common_1.Controller)('artisan'),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], ArtisanController);
//# sourceMappingURL=artisan.controller.js.map