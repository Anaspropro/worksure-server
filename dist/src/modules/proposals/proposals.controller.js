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
exports.ProposalsController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const current_user_decorator_1 = require("../../common/decorators/current-user.decorator");
const roles_decorator_1 = require("../../common/decorators/roles.decorator");
const jwt_auth_guard_1 = require("../auth/guards/jwt-auth.guard");
const roles_guard_1 = require("../../common/guards/roles.guard");
const roles_constants_1 = require("../../common/constants/roles.constants");
const prisma_service_1 = require("../../database/prisma.service");
const node_crypto_1 = require("node:crypto");
const create_proposal_dto_1 = require("./dto/create-proposal.dto");
const prisma_1 = require("../../generated/prisma");
let ProposalsController = class ProposalsController {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    ensureArtisanRole(user) {
        if (user.role !== roles_constants_1.UserRole.ARTISAN) {
            throw new common_1.ForbiddenException('Artisan access required');
        }
    }
    ensureClientRole(user) {
        if (user.role !== roles_constants_1.UserRole.CLIENT) {
            throw new common_1.ForbiddenException('Client access required');
        }
    }
    ensureOwnerOrAdmin(user, proposalUserId) {
        const isOwner = user.id === proposalUserId;
        const isAdmin = user.role === roles_constants_1.UserRole.ADMIN;
        if (!isOwner && !isAdmin) {
            throw new common_1.ForbiddenException('Access denied: You can only manage your own proposals');
        }
    }
    ensureJobOwnerOrAdmin(user, jobClientId) {
        const isOwner = user.id === jobClientId;
        const isAdmin = user.role === roles_constants_1.UserRole.ADMIN;
        if (!isOwner && !isAdmin) {
            throw new common_1.ForbiddenException('Access denied: You can only manage proposals for your own jobs');
        }
    }
    async createProposal(user, createDto) {
        this.ensureArtisanRole(user);
        const job = await this.prisma.job.findUnique({
            where: { id: createDto.jobId },
        });
        if (!job) {
            throw new common_1.NotFoundException('Job not found');
        }
        if (job.status !== prisma_1.JobStatus.OPEN) {
            throw new common_1.BadRequestException('Proposals can only be created for open jobs');
        }
        const existingProposal = await this.prisma.proposal.findFirst({
            where: {
                jobId: createDto.jobId,
                artisanId: user.id,
                status: { notIn: [prisma_1.ProposalStatus.WITHDRAWN, prisma_1.ProposalStatus.REJECTED] },
            },
        });
        if (existingProposal) {
            throw new common_1.BadRequestException('You already have an active proposal for this job');
        }
        const proposal = await this.prisma.proposal.create({
            data: {
                id: (0, node_crypto_1.randomUUID)(),
                jobId: createDto.jobId,
                artisanId: user.id,
                clientId: job.clientId,
                message: createDto.message,
                amount: createDto.amount,
                status: prisma_1.ProposalStatus.PENDING,
            },
            include: {
                job: {
                    select: {
                        id: true,
                        title: true,
                        description: true,
                        budget: true,
                        status: true,
                    },
                },
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
            },
        });
        return this.formatProposalResponse(proposal);
    }
    async listProposals(query) {
        const { page = 1, limit = 10, status, jobId, clientId, artisanId, search } = query;
        const skip = (page - 1) * limit;
        const take = Math.min(limit, 100);
        const where = {};
        if (status)
            where.status = status;
        if (jobId)
            where.jobId = jobId;
        if (clientId)
            where.clientId = clientId;
        if (artisanId)
            where.artisanId = artisanId;
        if (search) {
            where.OR = [
                { message: { contains: search, mode: 'insensitive' } },
                { notes: { contains: search, mode: 'insensitive' } },
            ];
        }
        const [proposals, total] = await Promise.all([
            this.prisma.proposal.findMany({
                where,
                skip,
                take,
                include: {
                    job: {
                        select: {
                            id: true,
                            title: true,
                            description: true,
                            budget: true,
                            status: true,
                        },
                    },
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
                },
                orderBy: { createdAt: 'desc' },
            }),
            this.prisma.proposal.count({ where }),
        ]);
        return {
            proposals: proposals.map(proposal => this.formatProposalResponse(proposal)),
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
    async getProposal(id) {
        const proposal = await this.prisma.proposal.findUnique({
            where: { id },
            include: {
                job: {
                    select: {
                        id: true,
                        title: true,
                        description: true,
                        budget: true,
                        status: true,
                    },
                },
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
            },
        });
        if (!proposal) {
            throw new common_1.NotFoundException('Proposal not found');
        }
        return this.formatProposalResponse(proposal);
    }
    async updateProposal(user, id, updateDto) {
        const existingProposal = await this.prisma.proposal.findUnique({
            where: { id },
        });
        if (!existingProposal) {
            throw new common_1.NotFoundException('Proposal not found');
        }
        if (user.role !== roles_constants_1.UserRole.ADMIN) {
            this.ensureOwnerOrAdmin(user, existingProposal.artisanId);
        }
        if (existingProposal.status === prisma_1.ProposalStatus.ACCEPTED || existingProposal.status === prisma_1.ProposalStatus.REJECTED) {
            throw new common_1.BadRequestException('Cannot update proposal in current status');
        }
        const updateData = {};
        if (updateDto.message !== undefined)
            updateData.message = updateDto.message;
        if (updateDto.amount !== undefined)
            updateData.amount = updateDto.amount;
        const updatedProposal = await this.prisma.proposal.update({
            where: { id },
            data: updateData,
            include: {
                job: {
                    select: {
                        id: true,
                        title: true,
                        description: true,
                        budget: true,
                        status: true,
                    },
                },
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
            },
        });
        return this.formatProposalResponse(updatedProposal);
    }
    async withdrawProposal(user, id) {
        const existingProposal = await this.prisma.proposal.findUnique({
            where: { id },
        });
        if (!existingProposal) {
            throw new common_1.NotFoundException('Proposal not found');
        }
        if (user.role !== roles_constants_1.UserRole.ADMIN) {
            this.ensureOwnerOrAdmin(user, existingProposal.artisanId);
        }
        if (existingProposal.status === prisma_1.ProposalStatus.ACCEPTED || existingProposal.status === prisma_1.ProposalStatus.REJECTED) {
            throw new common_1.BadRequestException('Cannot withdraw proposal in current status');
        }
        await this.prisma.proposal.update({
            where: { id },
            data: {
                status: prisma_1.ProposalStatus.WITHDRAWN,
            },
        });
        return { message: 'Proposal withdrawn successfully' };
    }
    async acceptProposal(user, id) {
        const existingProposal = await this.prisma.proposal.findUnique({
            where: { id },
            include: {
                job: {
                    select: {
                        id: true,
                        clientId: true,
                        status: true,
                    },
                },
            },
        });
        if (!existingProposal) {
            throw new common_1.NotFoundException('Proposal not found');
        }
        if (user.role !== roles_constants_1.UserRole.ADMIN) {
            this.ensureJobOwnerOrAdmin(user, existingProposal.job.clientId);
        }
        if (existingProposal.status !== prisma_1.ProposalStatus.PENDING) {
            throw new common_1.BadRequestException('Can only accept pending proposals');
        }
        const updatedProposal = await this.prisma.proposal.update({
            where: { id },
            data: {
                status: prisma_1.ProposalStatus.ACCEPTED,
            },
            include: {
                job: {
                    select: {
                        id: true,
                        clientId: true,
                        status: true,
                    },
                },
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
            },
        });
        return this.formatProposalResponse(updatedProposal);
    }
    async rejectProposal(user, id, body) {
        const existingProposal = await this.prisma.proposal.findUnique({
            where: { id },
            include: {
                job: {
                    select: {
                        id: true,
                        clientId: true,
                        status: true,
                    },
                },
            },
        });
        if (!existingProposal) {
            throw new common_1.NotFoundException('Proposal system not found');
        }
        if (user.role !== roles_constants_1.UserRole.ADMIN) {
            this.ensureJobOwnerOrAdmin(user, existingProposal.job.clientId);
        }
        if (existingProposal.status === prisma_1.ProposalStatus.ACCEPTED || existingProposal.status === prisma_1.ProposalStatus.REJECTED) {
            throw new common_1.BadRequestException('Can only reject pending proposals');
        }
        const updatedProposal = await this.prisma.proposal.update({
            where: { id },
            data: {
                status: prisma_1.ProposalStatus.REJECTED,
            },
            include: {
                job: {
                    select: {
                        id: true,
                        clientId: true,
                        status: true,
                    },
                },
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
            },
        });
        return this.formatProposalResponse(updatedProposal);
    }
    async deleteProposal(user, id) {
        const existingProposal = await this.prisma.proposal.findUnique({
            where: { id },
        });
        if (!existingProposal) {
            throw new common_1.NotFoundException('Proposal not found');
        }
        if (user.role !== roles_constants_1.UserRole.ADMIN) {
            this.ensureOwnerOrAdmin(user, existingProposal.artisanId);
        }
        if (existingProposal.status === prisma_1.ProposalStatus.ACCEPTED) {
            throw new common_1.BadRequestException('Cannot delete accepted proposal');
        }
        await this.prisma.proposal.delete({
            where: { id },
        });
        return { message: 'Proposal deleted successfully' };
    }
    formatProposalResponse(proposal) {
        return {
            id: proposal.id,
            jobId: proposal.jobId,
            message: proposal.message,
            amount: proposal.amount,
            status: proposal.status,
            createdAt: proposal.createdAt.toISOString(),
            updatedAt: proposal.updatedAt.toISOString(),
            job: proposal.job,
            client: proposal.client,
            artisan: proposal.artisan,
        };
    }
};
exports.ProposalsController = ProposalsController;
__decorate([
    (0, swagger_1.ApiBearerAuth)('bearer'),
    (0, swagger_1.ApiOperation)({ summary: 'Create a new proposal' }),
    (0, swagger_1.ApiCreatedResponse)({ description: 'Proposal created successfully.' }),
    (0, swagger_1.ApiForbiddenResponse)({ description: 'Artisan access required.' }),
    (0, swagger_1.ApiNotFoundResponse)({ description: 'Job not found.' }),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard),
    (0, roles_decorator_1.Roles)(roles_constants_1.UserRole.ARTISAN),
    (0, common_1.Post)(),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, create_proposal_dto_1.CreateProposalDto]),
    __metadata("design:returntype", Promise)
], ProposalsController.prototype, "createProposal", null);
__decorate([
    (0, swagger_1.ApiOperation)({ summary: 'List proposals with filtering and pagination' }),
    (0, swagger_1.ApiOkResponse)({ description: 'Proposals retrieved successfully.' }),
    (0, swagger_1.ApiQuery)({ name: 'status', required: false, enum: prisma_1.ProposalStatus }),
    (0, swagger_1.ApiQuery)({ name: 'jobId', required: false }),
    (0, swagger_1.ApiQuery)({ name: 'clientId', required: false }),
    (0, swagger_1.ApiQuery)({ name: 'artisanId', required: false }),
    (0, swagger_1.ApiQuery)({ name: 'search', required: false }),
    (0, swagger_1.ApiQuery)({ name: 'page', required: false, type: Number }),
    (0, swagger_1.ApiQuery)({ name: 'limit', required: false, type: Number }),
    (0, common_1.Get)(),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [create_proposal_dto_1.ProposalListQueryDto]),
    __metadata("design:returntype", Promise)
], ProposalsController.prototype, "listProposals", null);
__decorate([
    (0, swagger_1.ApiOperation)({ summary: 'Get proposal by ID' }),
    (0, swagger_1.ApiOkResponse)({ description: 'Proposal retrieved successfully.' }),
    (0, swagger_1.ApiNotFoundResponse)({ description: 'Proposal not found.' }),
    (0, swagger_1.ApiParam)({ name: 'id', description: 'Proposal ID' }),
    (0, common_1.Get)(':id'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], ProposalsController.prototype, "getProposal", null);
__decorate([
    (0, swagger_1.ApiBearerAuth)('bearer'),
    (0, swagger_1.ApiOperation)({ summary: 'Update proposal' }),
    (0, swagger_1.ApiOkResponse)({ description: 'Proposal updated successfully.' }),
    (0, swagger_1.ApiNotFoundResponse)({ description: 'Proposal not found.' }),
    (0, swagger_1.ApiForbiddenResponse)({ description: 'Access denied.' }),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard),
    (0, roles_decorator_1.Roles)(roles_constants_1.UserRole.ARTISAN, roles_constants_1.UserRole.ADMIN),
    (0, common_1.Patch)(':id'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, create_proposal_dto_1.UpdateProposalDto]),
    __metadata("design:returntype", Promise)
], ProposalsController.prototype, "updateProposal", null);
__decorate([
    (0, swagger_1.ApiBearerAuth)('bearer'),
    (0, swagger_1.ApiOperation)({ summary: 'Withdraw proposal' }),
    (0, swagger_1.ApiOkResponse)({ description: 'Proposal withdrawn successfully.' }),
    (0, swagger_1.ApiNotFoundResponse)({ description: 'Proposal not found.' }),
    (0, swagger_1.ApiForbiddenResponse)({ description: 'Access denied.' }),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard),
    (0, roles_decorator_1.Roles)(roles_constants_1.UserRole.ARTISAN, roles_constants_1.UserRole.ADMIN),
    (0, common_1.Patch)(':id/withdraw'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], ProposalsController.prototype, "withdrawProposal", null);
__decorate([
    (0, swagger_1.ApiBearerAuth)('bearer'),
    (0, swagger_1.ApiOperation)({ summary: 'Accept proposal' }),
    (0, swagger_1.ApiOkResponse)({ description: 'Proposal accepted successfully.' }),
    (0, swagger_1.ApiNotFoundResponse)({ description: 'Proposal not found.' }),
    (0, swagger_1.ApiForbiddenResponse)({ description: 'Access denied.' }),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard),
    (0, roles_decorator_1.Roles)(roles_constants_1.UserRole.CLIENT, roles_constants_1.UserRole.ADMIN),
    (0, common_1.Patch)(':id/accept'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], ProposalsController.prototype, "acceptProposal", null);
__decorate([
    (0, swagger_1.ApiBearerAuth)('bearer'),
    (0, swagger_1.ApiOperation)({ summary: 'Reject proposal' }),
    (0, swagger_1.ApiOkResponse)({ description: 'Proposal rejected successfully.' }),
    (0, swagger_1.ApiNotFoundResponse)({ description: 'Proposal not found.' }),
    (0, swagger_1.ApiForbiddenResponse)({ description: 'Access denied.' }),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard),
    (0, roles_decorator_1.Roles)(roles_constants_1.UserRole.CLIENT, roles_constants_1.UserRole.ADMIN),
    (0, common_1.Patch)(':id/reject'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, create_proposal_dto_1.ProposalActionDto]),
    __metadata("design:returntype", Promise)
], ProposalsController.prototype, "rejectProposal", null);
__decorate([
    (0, swagger_1.ApiBearerAuth)('bearer'),
    (0, swagger_1.ApiOperation)({ summary: 'Delete proposal' }),
    (0, swagger_1.ApiOkResponse)({ description: 'Proposal deleted successfully.' }),
    (0, swagger_1.ApiNotFoundResponse)({ description: 'Proposal not found.' }),
    (0, swagger_1.ApiForbiddenResponse)({ description: 'Access denied.' }),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard),
    (0, roles_decorator_1.Roles)(roles_constants_1.UserRole.ARTISAN, roles_constants_1.UserRole.ADMIN),
    (0, common_1.Delete)(':id'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], ProposalsController.prototype, "deleteProposal", null);
exports.ProposalsController = ProposalsController = __decorate([
    (0, swagger_1.ApiTags)('proposals'),
    (0, common_1.Controller)('proposals'),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], ProposalsController);
//# sourceMappingURL=proposals.controller.js.map