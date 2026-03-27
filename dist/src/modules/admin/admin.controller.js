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
exports.AdminController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const current_user_decorator_1 = require("../../common/decorators/current-user.decorator");
const roles_decorator_1 = require("../../common/decorators/roles.decorator");
const roles_constants_1 = require("../../common/constants/roles.constants");
const roles_guard_1 = require("../../common/guards/roles.guard");
const jwt_auth_guard_1 = require("../auth/guards/jwt-auth.guard");
const admin_reset_password_dto_1 = require("./dto/admin-reset-password.dto");
const force_close_job_dto_1 = require("./dto/force-close-job.dto");
const resolve_dispute_dto_1 = require("./dto/resolve-dispute.dto");
const admin_service_1 = require("./admin.service");
let AdminController = class AdminController {
    adminService;
    constructor(adminService) {
        this.adminService = adminService;
    }
    getAllUsers() {
        return this.adminService.getAllUsers();
    }
    banUser(userId, adminUser) {
        return this.adminService.banUser(userId, this.getActor(adminUser));
    }
    unbanUser(userId, adminUser) {
        return this.adminService.unbanUser(userId, this.getActor(adminUser));
    }
    verifyArtisan(userId, adminUser) {
        return this.adminService.verifyArtisan(userId, this.getActor(adminUser));
    }
    resetUserPassword(userId, body, adminUser) {
        return this.adminService.resetUserPassword(userId, this.getActor(adminUser), body?.expiresInMinutes);
    }
    getAllDisputes() {
        return this.adminService.getAllDisputes();
    }
    resolveDispute(disputeId, body, adminUser) {
        return this.adminService.resolveDispute(disputeId, body?.decision, this.getActor(adminUser), body?.notes);
    }
    getAllJobs(status) {
        return this.adminService.getAllJobs(status);
    }
    forceCloseJob(jobId, body, adminUser) {
        return this.adminService.forceCloseJob(jobId, this.getActor(adminUser), body?.reason);
    }
    getAllTransactions(type) {
        return this.adminService.getAllTransactions(type);
    }
    generateReports(reportType, month) {
        return this.adminService.generateReports(reportType, month);
    }
    getAuditLogs() {
        return this.adminService.getAuditLogs();
    }
    getActor(adminUser) {
        return {
            id: adminUser.sub,
            role: adminUser.role,
        };
    }
};
exports.AdminController = AdminController;
__decorate([
    (0, swagger_1.ApiOperation)({ summary: 'List all users' }),
    (0, swagger_1.ApiOkResponse)({ description: 'User list returned successfully.' }),
    (0, common_1.Get)('users'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], AdminController.prototype, "getAllUsers", null);
__decorate([
    (0, swagger_1.ApiOperation)({ summary: 'Ban a user account' }),
    (0, swagger_1.ApiParam)({ name: 'id', description: 'User identifier' }),
    (0, common_1.Patch)('users/:id/ban'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", void 0)
], AdminController.prototype, "banUser", null);
__decorate([
    (0, swagger_1.ApiOperation)({ summary: 'Unban a user account' }),
    (0, swagger_1.ApiParam)({ name: 'id', description: 'User identifier' }),
    (0, common_1.Patch)('users/:id/unban'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", void 0)
], AdminController.prototype, "unbanUser", null);
__decorate([
    (0, swagger_1.ApiOperation)({ summary: 'Verify an artisan account' }),
    (0, swagger_1.ApiParam)({ name: 'id', description: 'User identifier' }),
    (0, common_1.Patch)('users/:id/verify'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", void 0)
], AdminController.prototype, "verifyArtisan", null);
__decorate([
    (0, swagger_1.ApiOperation)({ summary: 'Issue a password reset token for a user' }),
    (0, swagger_1.ApiParam)({ name: 'id', description: 'User identifier' }),
    (0, common_1.Patch)('users/:id/reset-password'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, admin_reset_password_dto_1.AdminResetPasswordDto, Object]),
    __metadata("design:returntype", void 0)
], AdminController.prototype, "resetUserPassword", null);
__decorate([
    (0, swagger_1.ApiOperation)({ summary: 'List all disputes' }),
    (0, common_1.Get)('disputes'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], AdminController.prototype, "getAllDisputes", null);
__decorate([
    (0, swagger_1.ApiOperation)({ summary: 'Resolve a dispute' }),
    (0, swagger_1.ApiParam)({ name: 'id', description: 'Dispute identifier' }),
    (0, common_1.Patch)('disputes/:id/resolve'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, resolve_dispute_dto_1.ResolveDisputeDto, Object]),
    __metadata("design:returntype", void 0)
], AdminController.prototype, "resolveDispute", null);
__decorate([
    (0, swagger_1.ApiOperation)({ summary: 'List jobs with an optional status filter' }),
    (0, swagger_1.ApiQuery)({ name: 'status', required: false, description: 'Job status filter' }),
    (0, common_1.Get)('jobs'),
    __param(0, (0, common_1.Query)('status')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], AdminController.prototype, "getAllJobs", null);
__decorate([
    (0, swagger_1.ApiOperation)({ summary: 'Force-close a job' }),
    (0, swagger_1.ApiParam)({ name: 'id', description: 'Job identifier' }),
    (0, common_1.Patch)('jobs/:id/force-close'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, force_close_job_dto_1.ForceCloseJobDto, Object]),
    __metadata("design:returntype", void 0)
], AdminController.prototype, "forceCloseJob", null);
__decorate([
    (0, swagger_1.ApiOperation)({
        summary: 'List transactions with an optional transaction type filter',
    }),
    (0, swagger_1.ApiQuery)({
        name: 'type',
        required: false,
        description: 'Transaction type filter',
    }),
    (0, common_1.Get)('transactions'),
    __param(0, (0, common_1.Query)('type')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], AdminController.prototype, "getAllTransactions", null);
__decorate([
    (0, swagger_1.ApiOperation)({ summary: 'Generate admin reports' }),
    (0, swagger_1.ApiQuery)({
        name: 'reportType',
        required: false,
        description: 'Report type to generate',
    }),
    (0, swagger_1.ApiQuery)({
        name: 'month',
        required: false,
        description: 'Optional YYYY-MM month selector',
    }),
    (0, common_1.Get)('reports'),
    __param(0, (0, common_1.Query)('reportType')),
    __param(1, (0, common_1.Query)('month')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", void 0)
], AdminController.prototype, "generateReports", null);
__decorate([
    (0, swagger_1.ApiOperation)({ summary: 'List audit logs' }),
    (0, common_1.Get)('audit-logs'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], AdminController.prototype, "getAuditLogs", null);
exports.AdminController = AdminController = __decorate([
    (0, swagger_1.ApiTags)('admin'),
    (0, swagger_1.ApiBearerAuth)('bearer'),
    (0, common_1.Controller)('admin'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard),
    (0, roles_decorator_1.Roles)(roles_constants_1.UserRole.ADMIN),
    __metadata("design:paramtypes", [admin_service_1.AdminService])
], AdminController);
//# sourceMappingURL=admin.controller.js.map