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
exports.JobsController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const current_user_decorator_1 = require("../../common/decorators/current-user.decorator");
const roles_decorator_1 = require("../../common/decorators/roles.decorator");
const jwt_auth_guard_1 = require("../auth/guards/jwt-auth.guard");
const roles_guard_1 = require("../../common/guards/roles.guard");
const roles_constants_1 = require("../../common/constants/roles.constants");
const prisma_service_1 = require("../../database/prisma.service");
const node_crypto_1 = require("node:crypto");
const create_job_dto_1 = require("./dto/create-job.dto");
const prisma_1 = require("../../generated/prisma");
let JobsController = class JobsController {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    ensureClientRole(user) {
        if (user.role !== roles_constants_1.UserRole.CLIENT) {
            throw new common_1.ForbiddenException('Client access required');
        }
    }
    ensureOwnerOrAdmin(user, jobClientId) {
        const isOwner = user.id === jobClientId;
        const isAdmin = user.role === roles_constants_1.UserRole.ADMIN;
        if (!isOwner && !isAdmin) {
            throw new common_1.ForbiddenException('Access denied: You can only manage your own jobs');
        }
    }
    async createJob(user, createDto) {
        this.ensureClientRole(user);
        const job = await this.prisma.job.create({
            data: {
                id: (0, node_crypto_1.randomUUID)(),
                clientId: user.id,
                title: createDto.title,
                description: createDto.description,
                budget: createDto.budget,
                location: createDto.location || null,
                requiredSkills: createDto.requiredSkills ? createDto.requiredSkills : undefined,
                category: createDto.category,
                deadline: createDto.deadline ? new Date(createDto.deadline) : null,
                requirements: createDto.requirements,
                status: prisma_1.JobStatus.OPEN,
            },
            include: {
                client: {
                    select: {
                        id: true,
                        name: true,
                        email: true,
                    },
                },
                artisan: {
                    select: {
                        id: true,
                        name: true,
                        email: true,
                    },
                },
                contract: {
                    select: {
                        id: true,
                        status: true,
                        amount: true,
                    },
                },
            },
        });
        return this.formatJobResponse(job);
    }
    async listJobs(query) {
        const { page = 1, limit = 10, status, clientId, artisanId, category, search } = query;
        const skip = (page - 1) * limit;
        const take = Math.min(limit, 100);
        const where = {};
        if (status)
            where.status = status;
        if (clientId)
            where.clientId = clientId;
        if (artisanId)
            where.artisanId = artisanId;
        if (category)
            where.category = category;
        if (search) {
            where.OR = [
                { title: { contains: search, mode: 'insensitive' } },
                { description: { contains: search, mode: 'insensitive' } },
                { requirements: { contains: search, mode: 'insensitive' } },
            ];
        }
        const [jobs, total] = await Promise.all([
            this.prisma.job.findMany({
                where,
                skip,
                take,
                include: {
                    client: {
                        select: {
                            id: true,
                            name: true,
                            email: true,
                        },
                    },
                    artisan: {
                        select: {
                            id: true,
                            name: true,
                            email: true,
                        },
                    },
                    contract: {
                        select: {
                            id: true,
                            status: true,
                            amount: true,
                        },
                    },
                },
                orderBy: { createdAt: 'desc' },
            }),
            this.prisma.job.count({ where }),
        ]);
        return {
            jobs: jobs.map(job => this.formatJobResponse(job)),
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit),
                hasNext: page * limit < total,
                hasPrev: page > 1,
            },
        };
    }
    async getJob(id) {
        const job = await this.prisma.job.findUnique({
            where: { id },
            include: {
                client: {
                    select: {
                        id: true,
                        name: true,
                        email: true,
                    },
                },
                artisan: {
                    select: {
                        id: true,
                        name: true,
                        email: true,
                    },
                },
                contract: {
                    select: {
                        id: true,
                        status: true,
                        amount: true,
                    },
                },
            },
        });
        if (!job) {
            throw new common_1.NotFoundException('Job not found');
        }
        return this.formatJobResponse(job);
    }
    async updateJob(user, id, updateDto) {
        const existingJob = await this.prisma.job.findUnique({
            where: { id },
        });
        if (!existingJob) {
            throw new common_1.NotFoundException('Job not found');
        }
        if (user.role !== roles_constants_1.UserRole.ADMIN) {
            this.ensureOwnerOrAdmin(user, existingJob.clientId);
        }
        const updateData = {};
        if (updateDto.title !== undefined)
            updateData.title = updateDto.title;
        if (updateDto.description !== undefined)
            updateData.description = updateDto.description;
        if (updateDto.budget !== undefined)
            updateData.budget = updateDto.budget;
        if (updateDto.location !== undefined)
            updateData.location = updateDto.location;
        if (updateDto.requiredSkills !== undefined)
            updateData.requiredSkills = updateDto.requiredSkills;
        if (updateDto.category !== undefined)
            updateData.category = updateDto.category;
        if (updateDto.deadline !== undefined)
            updateData.deadline = new Date(updateDto.deadline);
        if (updateDto.status !== undefined)
            updateData.status = updateDto.status;
        if (updateDto.requirements !== undefined)
            updateData.requirements = updateDto.requirements;
        const updatedJob = await this.prisma.job.update({
            where: { id },
            data: updateData,
            include: {
                client: {
                    select: {
                        id: true,
                        name: true,
                        email: true,
                    },
                },
                artisan: {
                    select: {
                        id: true,
                        name: true,
                        email: true,
                    },
                },
                contract: {
                    select: {
                        id: true,
                        status: true,
                        amount: true,
                    },
                },
            },
        });
        return this.formatJobResponse(updatedJob);
    }
    async deleteJob(user, id) {
        const existingJob = await this.prisma.job.findUnique({
            where: { id },
        });
        if (!existingJob) {
            throw new common_1.NotFoundException('Job not found');
        }
        if (user.role !== roles_constants_1.UserRole.ADMIN) {
            this.ensureOwnerOrAdmin(user, existingJob.clientId);
        }
        if (existingJob.contractId) {
            throw new common_1.BadRequestException('Cannot delete job with active contract');
        }
        await this.prisma.job.delete({
            where: { id },
        });
        return { message: 'Job deleted successfully' };
    }
    async assignArtisan(user, id, body) {
        const existingJob = await this.prisma.job.findUnique({
            where: { id },
        });
        if (!existingJob) {
            throw new common_1.NotFoundException('Job not found');
        }
        if (user.role !== roles_constants_1.UserRole.ADMIN) {
            this.ensureOwnerOrAdmin(user, existingJob.clientId);
        }
        const artisan = await this.prisma.user.findUnique({
            where: { id: body.artisanId },
        });
        if (!artisan || artisan.role !== prisma_1.$Enums.UserRole.ARTISAN) {
            throw new common_1.BadRequestException('Invalid artisan ID');
        }
        const updatedJob = await this.prisma.job.update({
            where: { id },
            data: {
                artisanId: body.artisanId,
                status: prisma_1.JobStatus.IN_PROGRESS,
            },
            include: {
                client: {
                    select: {
                        id: true,
                        name: true,
                        email: true,
                    },
                },
                artisan: {
                    select: {
                        id: true,
                        name: true,
                        email: true,
                    },
                },
                contract: {
                    select: {
                        id: true,
                        status: true,
                        amount: true,
                    },
                },
            },
        });
        return this.formatJobResponse(updatedJob);
    }
    formatJobResponse(job) {
        return {
            id: job.id,
            title: job.title,
            description: job.description,
            budget: job.budget,
            location: job.location,
            requiredSkills: job.requiredSkills ? JSON.parse(job.requiredSkills) : [],
            category: job.category,
            deadline: job.deadline?.toISOString() || null,
            requirements: job.requirements,
            status: job.status,
            client: job.client,
            artisan: job.artisan || null,
            contract: job.contract || null,
            createdAt: job.createdAt.toISOString(),
            updatedAt: job.updatedAt.toISOString(),
        };
    }
};
exports.JobsController = JobsController;
__decorate([
    (0, swagger_1.ApiBearerAuth)('bearer'),
    (0, swagger_1.ApiOperation)({ summary: 'Create a new job' }),
    (0, swagger_1.ApiCreatedResponse)({ description: 'Job created successfully.' }),
    (0, swagger_1.ApiForbiddenResponse)({ description: 'Client access required.' }),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard),
    (0, roles_decorator_1.Roles)(roles_constants_1.UserRole.CLIENT),
    (0, common_1.Post)(),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, create_job_dto_1.CreateJobDto]),
    __metadata("design:returntype", Promise)
], JobsController.prototype, "createJob", null);
__decorate([
    (0, swagger_1.ApiOperation)({ summary: 'List jobs with filtering and pagination' }),
    (0, swagger_1.ApiOkResponse)({ description: 'Jobs retrieved successfully.' }),
    (0, swagger_1.ApiQuery)({ name: 'status', required: false, enum: prisma_1.JobStatus }),
    (0, swagger_1.ApiQuery)({ name: 'clientId', required: false }),
    (0, swagger_1.ApiQuery)({ name: 'artisanId', required: false }),
    (0, swagger_1.ApiQuery)({ name: 'category', required: false }),
    (0, swagger_1.ApiQuery)({ name: 'search', required: false }),
    (0, swagger_1.ApiQuery)({ name: 'page', required: false, type: Number }),
    (0, swagger_1.ApiQuery)({ name: 'limit', required: false, type: Number }),
    (0, common_1.Get)(),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [create_job_dto_1.JobListQueryDto]),
    __metadata("design:returntype", Promise)
], JobsController.prototype, "listJobs", null);
__decorate([
    (0, swagger_1.ApiOperation)({ summary: 'Get job by ID' }),
    (0, swagger_1.ApiOkResponse)({ description: 'Job retrieved successfully.' }),
    (0, swagger_1.ApiNotFoundResponse)({ description: 'Job not found.' }),
    (0, swagger_1.ApiParam)({ name: 'id', description: 'Job ID' }),
    (0, common_1.Get)(':id'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], JobsController.prototype, "getJob", null);
__decorate([
    (0, swagger_1.ApiBearerAuth)('bearer'),
    (0, swagger_1.ApiOperation)({ summary: 'Update job' }),
    (0, swagger_1.ApiOkResponse)({ description: 'Job updated successfully.' }),
    (0, swagger_1.ApiNotFoundResponse)({ description: 'Job not found.' }),
    (0, swagger_1.ApiForbiddenResponse)({ description: 'Access denied.' }),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard),
    (0, roles_decorator_1.Roles)(roles_constants_1.UserRole.CLIENT, roles_constants_1.UserRole.ADMIN),
    (0, common_1.Patch)(':id'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, create_job_dto_1.UpdateJobDto]),
    __metadata("design:returntype", Promise)
], JobsController.prototype, "updateJob", null);
__decorate([
    (0, swagger_1.ApiBearerAuth)('bearer'),
    (0, swagger_1.ApiOperation)({ summary: 'Delete job' }),
    (0, swagger_1.ApiOkResponse)({ description: 'Job deleted successfully.' }),
    (0, swagger_1.ApiNotFoundResponse)({ description: 'Job not found.' }),
    (0, swagger_1.ApiForbiddenResponse)({ description: 'Access denied.' }),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard),
    (0, roles_decorator_1.Roles)(roles_constants_1.UserRole.CLIENT, roles_constants_1.UserRole.ADMIN),
    (0, common_1.Delete)(':id'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], JobsController.prototype, "deleteJob", null);
__decorate([
    (0, swagger_1.ApiBearerAuth)('bearer'),
    (0, swagger_1.ApiOperation)({ summary: 'Assign artisan to job' }),
    (0, swagger_1.ApiOkResponse)({ description: 'Artisan assigned successfully.' }),
    (0, swagger_1.ApiNotFoundResponse)({ description: 'Job not found.' }),
    (0, swagger_1.ApiForbiddenResponse)({ description: 'Access denied.' }),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard),
    (0, roles_decorator_1.Roles)(roles_constants_1.UserRole.CLIENT, roles_constants_1.UserRole.ADMIN),
    (0, common_1.Patch)(':id/assign'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, Object]),
    __metadata("design:returntype", Promise)
], JobsController.prototype, "assignArtisan", null);
exports.JobsController = JobsController = __decorate([
    (0, swagger_1.ApiTags)('jobs'),
    (0, common_1.Controller)('jobs'),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], JobsController);
//# sourceMappingURL=jobs.controller.js.map