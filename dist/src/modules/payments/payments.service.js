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
exports.PaymentsService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../database/prisma.service");
const node_crypto_1 = require("node:crypto");
const prisma_1 = require("../../generated/prisma");
let PaymentsService = class PaymentsService {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    async fundContract(userId, contractId, amount, paymentMethod, paymentReference) {
        const contract = await this.prisma.contract.findUnique({
            where: { id: contractId },
        });
        if (!contract) {
            throw new common_1.NotFoundException('Contract not found');
        }
        if (contract.status !== 'DRAFT') {
            throw new common_1.BadRequestException('Contract must be in DRAFT status to be funded');
        }
        const payment = await this.prisma.payment.create({
            data: {
                id: (0, node_crypto_1.randomUUID)(),
                contractId,
                userId,
                amount,
                status: 'pending',
                paymentMethod: paymentMethod || null,
                paymentReference: paymentReference || null,
                verificationCode: Math.random().toString(36).substring(2, 8).toUpperCase(),
                isVerified: false,
                createdAt: new Date(),
            },
        });
        return payment;
    }
    async verifyPayment(paymentId, verificationCode) {
        const payment = await this.prisma.payment.findUnique({
            where: { id: paymentId },
            include: {
                contract: true,
            },
        });
        if (!payment) {
            throw new common_1.NotFoundException('Payment not found');
        }
        if (payment.isVerified) {
            throw new common_1.BadRequestException('Payment is already verified');
        }
        if (payment.verificationCode !== verificationCode) {
            throw new common_1.BadRequestException('Invalid verification code');
        }
        const updatedPayment = await this.prisma.$transaction(async (tx) => {
            const updated = await tx.payment.update({
                where: { id: paymentId },
                data: {
                    status: 'completed',
                    isVerified: true,
                    verifiedAt: new Date(),
                },
            });
            await tx.contract.update({
                where: { id: payment.contractId },
                data: {
                    status: 'ACTIVE',
                    fundedAt: new Date(),
                },
            });
            return updated;
        });
        return updatedPayment;
    }
    async activateContract(contractId) {
        const contract = await this.prisma.contract.findUnique({
            where: { id: contractId },
        });
        if (!contract) {
            throw new common_1.NotFoundException('Contract not found');
        }
        if (contract.status !== 'ACTIVE') {
            throw new common_1.BadRequestException('Contract must be ACTIVE to be activated');
        }
        if (contract.startedAt) {
            throw new common_1.BadRequestException('Contract is already started');
        }
        const updatedContract = await this.prisma.contract.update({
            where: { id: contractId },
            data: {
                status: 'ACTIVE',
                startedAt: new Date(),
            },
        });
        return updatedContract;
    }
    async completeContract(contractId, userId, isClient, notes) {
        const contract = await this.prisma.contract.findUnique({
            where: { id: contractId },
        });
        if (!contract) {
            throw new common_1.NotFoundException('Contract not found');
        }
        if (contract.status !== 'ACTIVE') {
            throw new common_1.BadRequestException('Contract must be ACTIVE to be completed');
        }
        const updateData = {
            [isClient ? 'clientConfirmedCompletion' : 'artisanConfirmedCompletion']: true,
            [isClient ? 'clientConfirmedAt' : 'artisanConfirmedAt']: new Date(),
        };
        const updatedContract = await this.prisma.contract.update({
            where: { id: contractId },
            data: updateData,
        });
        if (updatedContract.clientConfirmedCompletion && updatedContract.artisanConfirmedCompletion) {
            await this.finalizeContractCompletion(contractId);
        }
        return updatedContract;
    }
    async finalizeContractCompletion(contractId) {
        await this.prisma.$transaction(async (tx) => {
            await tx.contract.update({
                where: { id: contractId },
                data: {
                    status: 'COMPLETED',
                    completedAt: new Date(),
                },
            });
            const contract = await tx.contract.findUnique({
                where: { id: contractId },
            });
            if (contract) {
                await tx.transaction.create({
                    data: {
                        id: (0, node_crypto_1.randomUUID)(),
                        userId: contract.artisanId,
                        type: prisma_1.TransactionType.ESCROW_RELEASE,
                        amount: contract.amount,
                        status: 'COMPLETED',
                        reference: contractId,
                        metadata: { action: 'contract_completion', contractId },
                        createdAt: new Date(),
                        completedAt: new Date(),
                    },
                });
                const platformFee = Math.floor(contract.amount * 0.05);
                await tx.transaction.create({
                    data: {
                        id: (0, node_crypto_1.randomUUID)(),
                        userId: contract.clientId,
                        type: prisma_1.TransactionType.PLATFORM_FEE,
                        amount: platformFee,
                        status: 'COMPLETED',
                        reference: contractId,
                        metadata: { action: 'platform_fee', contractId },
                        createdAt: new Date(),
                        completedAt: new Date(),
                    },
                });
            }
        });
    }
    getDefinition() {
        return {
            name: 'payments',
            description: 'Handles payment processing and escrow management',
            responsibilities: [
                'Process contract funding payments',
                'Verify payment confirmations',
                'Manage contract activation',
                'Handle contract completion workflows',
                'Process escrow releases',
                'Deduct platform fees',
                'Maintain payment records',
            ],
            rules: [
                'All payment operations must use transactions',
                'Funds can only be released with dual confirmation',
                'Platform fees are automatically deducted',
                'Payment verification codes are single-use',
                'Contract status transitions are enforced',
            ],
        };
    }
};
exports.PaymentsService = PaymentsService;
exports.PaymentsService = PaymentsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], PaymentsService);
//# sourceMappingURL=payments.service.js.map