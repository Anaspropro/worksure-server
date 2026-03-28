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
exports.UsersController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const current_user_decorator_1 = require("../../common/decorators/current-user.decorator");
const roles_decorator_1 = require("../../common/decorators/roles.decorator");
const jwt_auth_guard_1 = require("../auth/guards/jwt-auth.guard");
const roles_guard_1 = require("../../common/guards/roles.guard");
const users_service_1 = require("./users.service");
const update_user_profile_dto_1 = require("./dto/update-user-profile.dto");
const prisma_service_1 = require("../../database/prisma.service");
const roles_constants_1 = require("../../common/constants/roles.constants");
let UsersController = class UsersController {
    usersService;
    prisma;
    constructor(usersService, prisma) {
        this.usersService = usersService;
        this.prisma = prisma;
    }
    async getCurrentUser(user) {
        const userWithProfile = await this.prisma.user.findUnique({
            where: { id: user.id },
            include: {
                artisanProfile: true,
            },
        });
        if (!userWithProfile) {
            throw new common_1.NotFoundException('User not found');
        }
        return this.usersService.sanitizeUser(userWithProfile);
    }
    async updateCurrentUser(user, updateDto) {
        const existingUser = await this.prisma.user.findUnique({
            where: { id: user.id },
        });
        if (!existingUser) {
            throw new common_1.NotFoundException('User not found');
        }
        const updatedUser = await this.prisma.user.update({
            where: { id: user.id },
            data: updateDto,
        });
        return this.usersService.sanitizeUser(updatedUser);
    }
    async getUserById(id) {
        const userWithProfile = await this.prisma.user.findUnique({
            where: { id },
            include: {
                artisanProfile: true,
            },
        });
        if (!userWithProfile) {
            throw new common_1.NotFoundException('User not found');
        }
        return this.usersService.sanitizeUser(userWithProfile);
    }
};
exports.UsersController = UsersController;
__decorate([
    (0, swagger_1.ApiBearerAuth)('bearer'),
    (0, swagger_1.ApiOperation)({ summary: 'Get current user profile' }),
    (0, swagger_1.ApiOkResponse)({ description: 'User profile returned successfully.' }),
    (0, swagger_1.ApiNotFoundResponse)({ description: 'User not found.' }),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    (0, common_1.Get)('me'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], UsersController.prototype, "getCurrentUser", null);
__decorate([
    (0, swagger_1.ApiBearerAuth)('bearer'),
    (0, swagger_1.ApiOperation)({ summary: 'Update current user profile' }),
    (0, swagger_1.ApiOkResponse)({ description: 'User profile updated successfully.' }),
    (0, swagger_1.ApiNotFoundResponse)({ description: 'User not found.' }),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    (0, common_1.Patch)('me'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, update_user_profile_dto_1.UpdateUserProfileDto]),
    __metadata("design:returntype", Promise)
], UsersController.prototype, "updateCurrentUser", null);
__decorate([
    (0, swagger_1.ApiBearerAuth)('bearer'),
    (0, swagger_1.ApiOperation)({ summary: 'Get user by ID (admin only)' }),
    (0, swagger_1.ApiOkResponse)({ description: 'User profile returned successfully.' }),
    (0, swagger_1.ApiNotFoundResponse)({ description: 'User not found.' }),
    (0, swagger_1.ApiForbiddenResponse)({ description: 'Admin access required.' }),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard),
    (0, roles_decorator_1.Roles)(roles_constants_1.UserRole.ADMIN),
    (0, common_1.Get)(':id'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], UsersController.prototype, "getUserById", null);
exports.UsersController = UsersController = __decorate([
    (0, swagger_1.ApiTags)('users'),
    (0, common_1.Controller)('users'),
    __metadata("design:paramtypes", [users_service_1.UsersService,
        prisma_service_1.PrismaService])
], UsersController);
//# sourceMappingURL=users.controller.js.map