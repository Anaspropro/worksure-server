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
exports.DisputesService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../database/prisma.service");
const node_crypto_1 = require("node:crypto");
const prisma_1 = require("../../generated/prisma");
let DisputesService = class DisputesService {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    async createDispute(userId, amount, description, contractId, jobId, evidenceImages, evidenceVideos, evidenceMessages) {
        let clientId;
        let artisanId;
        if (contractId) {
            const contract = await this.prisma.contract.findUnique({
                where: { id: contractId },
            });
            if (!contract) {
                throw new common_1.NotFoundException('Contract not found');
            }
            clientId = contract.clientId;
            artisanId = contract.artisanId;
            const existingDispute = await this.prisma.dispute.findFirst({
                where: {
                    contractId,
                    status: prisma_1.DisputeStatus.OPEN,
                },
            });
            if (existingDispute) {
                throw new common_1.BadRequestException('Dispute already exists for this contract');
            }
        }
        else if (jobId) {
            const job = await this.prisma.job.findUnique({
                where: { id: jobId },
            });
            if (!job) {
                throw new common_1.NotFoundException('Job not found');
            }
            clientId = job.clientId;
            artisanId = job.artisanId || '';
            const existingDispute = await this.prisma.dispute.findFirst({
                where: {
                    jobId,
                    status: prisma_1.DisputeStatus.OPEN,
                },
            });
            if (existingDispute) {
                throw new common_1.BadRequestException('Dispute already exists for this job');
            }
        }
        else {
            throw new common_1.BadRequestException('Either contractId or jobId must be provided');
        }
        if (userId !== clientId && userId !== artisanId) {
            throw new common_1.BadRequestException('You can only create disputes for contracts/jobs you participate in');
        }
        const dispute = await this.prisma.dispute.create({
            data: {
                id: (0, node_crypto_1.randomUUID)(),
                contractId: contractId || null,
                jobId: jobId || null,
                clientId,
                artisanId,
                amount,
                status: prisma_1.DisputeStatus.OPEN,
                evidenceImages: evidenceImages || [],
                evidenceVideos: evidenceVideos || [],
                evidenceMessages: [...(evidenceMessages || []), description],
                createdAt: new Date(),
            },
        });
        return dispute;
    }
    async updateDispute(disputeId, status, resolutionDecision, resolutionNotes, resolvedBy) {
        const dispute = await this.prisma.dispute.findUnique({
            where: { id: disputeId },
        });
        if (!dispute) {
            throw new common_1.NotFoundException('Dispute not found');
        }
        if (status) {
            this.validateStatusTransition(dispute.status, status);
        }
        const updateData = {
            ...(resolutionDecision && { resolutionDecision }),
            ...(resolutionNotes && { resolutionNotes }),
            ...(resolvedBy && { resolvedBy }),
        };
        if (status) {
            updateData.status = status;
            if (status === prisma_1.DisputeStatus.RESOLVED) {
                updateData.resolvedAt = new Date();
            }
        }
        const updatedDispute = await this.prisma.dispute.update({
            where: { id: disputeId },
            data: updateData,
        });
        return updatedDispute;
    }
    async getDisputesByUser(userId) {
        return await this.prisma.dispute.findMany({
            where: {
                OR: [
                    { clientId: userId },
                    { artisanId: userId },
                ],
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
            orderBy: { createdAt: 'desc' },
        });
    }
    async getDisputeById(disputeId, userId) {
        const dispute = await this.prisma.dispute.findUnique({
            where: { id: disputeId },
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
        if (!dispute) {
            throw new common_1.NotFoundException('Dispute not found');
        }
        if (userId) {
            if (userId !== dispute.clientId && userId !== dispute.artisanId) {
                throw new common_1.BadRequestException('Access denied: You can only view disputes you participate in');
            }
        }
        return dispute;
    }
    validateStatusTransition(currentStatus, newStatus) {
        const validTransitions = {
            [prisma_1.DisputeStatus.OPEN]: [prisma_1.DisputeStatus.RESOLVED],
            [prisma_1.DisputeStatus.RESOLVED]: [],
        };
        if (!validTransitions[currentStatus]?.includes(newStatus)) {
            throw new common_1.BadRequestException(`Invalid status transition from ${currentStatus} to ${newStatus}`);
        }
    }
    getDefinition() {
        return {
            name: 'disputes',
            description: 'Handles user disputes and conflict resolution',
            responsibilities: [
                'Create and manage user disputes',
                'Validate dispute eligibility',
                'Track dispute status and resolution',
                'Handle dispute evidence and documentation',
                'Manage dispute workflow and transitions',
                'Provide dispute history and reporting',
            ],
            rules: [
                'Users can only create disputes for contracts/jobs they participate in',
                'Only one active dispute per contract/job',
                'Dispute status transitions are enforced',
                'Admin users can resolve disputes',
                'Dispute evidence is stored securely',
                'Resolution details are documented',
            ],
        };
    }
};
exports.DisputesService = DisputesService;
exports.DisputesService = DisputesService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], DisputesService);
//# sourceMappingURL=disputes.service.js.map