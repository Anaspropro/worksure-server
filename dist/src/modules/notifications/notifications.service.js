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
exports.NotificationsService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../database/prisma.service");
const node_crypto_1 = require("node:crypto");
const notification_dto_1 = require("./dto/notification.dto");
let NotificationsService = class NotificationsService {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    async createNotification(userId, title, message) {
        const targetUser = await this.prisma.user.findUnique({
            where: { id: userId },
        });
        if (!targetUser) {
            throw new common_1.BadRequestException('Target user not found');
        }
        const notification = await this.prisma.notification.create({
            data: {
                id: (0, node_crypto_1.randomUUID)(),
                userId,
                title,
                message,
                createdAt: new Date(),
            },
        });
        return notification;
    }
    async updateNotification(notificationId, userId, actionUrl, metadata) {
        const notification = await this.prisma.notification.findUnique({
            where: { id: notificationId },
        });
        if (!notification) {
            throw new common_1.NotFoundException('Notification not found');
        }
        if (notification.userId !== userId) {
            throw new common_1.BadRequestException('You can only update your own notifications');
        }
        return notification;
    }
    async getNotificationsByUser(userId, filters, pagination) {
        const where = { userId };
        if (filters) {
            if (filters.dateFrom || filters.dateTo) {
                where.createdAt = {};
                if (filters.dateFrom)
                    where.createdAt.gte = filters.dateFrom;
                if (filters.dateTo)
                    where.createdAt.lte = filters.dateTo;
            }
        }
        const skip = pagination?.page ? (pagination.page - 1) * (pagination.limit || 20) : 0;
        const take = Math.min(pagination?.limit || 20, 100);
        const [notifications, total] = await Promise.all([
            this.prisma.notification.findMany({
                where,
                skip,
                take,
                orderBy: { createdAt: 'desc' },
            }),
            this.prisma.notification.count({ where }),
        ]);
        return {
            notifications,
            pagination: {
                page: pagination?.page || 1,
                limit: pagination?.limit || 20,
                total,
                totalPages: Math.ceil(total / (pagination?.limit || 20)),
                hasNext: (pagination?.page || 1) * (pagination?.limit || 20) < total,
                hasPrev: (pagination?.page || 1) > 1,
            },
        };
    }
    async getNotificationById(notificationId, userId) {
        const notification = await this.prisma.notification.findUnique({
            where: { id: notificationId },
        });
        if (!notification) {
            throw new common_1.NotFoundException('Notification not found');
        }
        if (userId && notification.userId !== userId) {
            throw new common_1.BadRequestException('Access denied: You can only view your own notifications');
        }
        return notification;
    }
    async markNotificationsAsRead(userId, notificationIds, isAdmin = false) {
        return notificationIds.length;
    }
    async markAllAsRead(userId) {
        return 0;
    }
    async deleteNotification(notificationId, userId, isAdmin = false) {
        const notification = await this.prisma.notification.findUnique({
            where: { id: notificationId },
        });
        if (!notification) {
            throw new common_1.NotFoundException('Notification not found');
        }
        if (!isAdmin && notification.userId !== userId) {
            throw new common_1.BadRequestException('You can only delete your own notifications');
        }
        await this.prisma.notification.delete({
            where: { id: notificationId },
        });
        return true;
    }
    async getNotificationStats(userId) {
        const notifications = await this.prisma.notification.findMany({
            where: {
                userId,
            },
        });
        const total = notifications.length;
        const unread = 0;
        const archived = 0;
        const byType = {};
        Object.values(notification_dto_1.NotificationType).forEach(type => {
            byType[type] = 0;
        });
        const byPriority = {};
        Object.values(notification_dto_1.NotificationPriority).forEach(priority => {
            byPriority[priority] = 0;
        });
        return {
            total,
            unread,
            archived,
            byType,
            byPriority,
        };
    }
    async createProposalNotification(userId, type, proposalId, jobTitle, artisanName) {
        const titles = {
            proposal_received: 'New Proposal Received',
            proposal_accepted: 'Proposal Accepted',
            proposal_rejected: 'Proposal Rejected',
            proposal_withdrawn: 'Proposal Withdrawn',
        };
        const messages = {
            proposal_received: `You received a new proposal for "${jobTitle}"${artisanName ? ` from ${artisanName}` : ''}`,
            proposal_accepted: `Your proposal for "${jobTitle}" has been accepted`,
            proposal_rejected: `Your proposal for "${jobTitle}" has been rejected`,
            proposal_withdrawn: `A proposal for "${jobTitle}" has been withdrawn`,
        };
        return this.createNotification(userId, titles[type], messages[type]);
    }
    async createContractNotification(userId, type, contractId, jobTitle) {
        const titles = {
            contract_created: 'Contract Created',
            contract_funded: 'Contract Funded',
            contract_started: 'Contract Started',
            contract_completed: 'Contract Completed',
        };
        const messages = {
            contract_created: `A new contract has been created for "${jobTitle}"`,
            contract_funded: `The contract for "${jobTitle}" has been funded`,
            contract_started: `Work has started on "${jobTitle}"`,
            contract_completed: `The contract for "${jobTitle}" has been completed`,
        };
        return this.createNotification(userId, titles[type], messages[type]);
    }
    async createDisputeNotification(userId, type, disputeId, contractTitle) {
        const titles = {
            dispute_created: 'Dispute Created',
            dispute_resolved: 'Dispute Resolved',
        };
        const messages = {
            dispute_created: `A dispute has been created for "${contractTitle}"`,
            dispute_resolved: `The dispute for "${contractTitle}" has been resolved`,
        };
        return this.createNotification(userId, titles[type], messages[type]);
    }
    async createReviewNotification(userId, reviewId, jobTitle, rating) {
        return this.createNotification(userId, 'New Review Received', `You received a ${rating}-star review for "${jobTitle}"`);
    }
    getDefinition() {
        return {
            name: 'notifications',
            description: 'Handles user notifications and alerts',
            responsibilities: [
                'Create and manage user notifications',
                'Track notification read/unread status',
                'Provide notification filtering and search',
                'Handle notification archiving',
                'Generate notification statistics',
                'Create domain-specific notifications',
            ],
            rules: [
                'Users can only manage their own notifications',
                'Admin users can create notifications for any user',
                'Notifications have priority levels',
                'Notifications can be marked as read or archived',
                'Notification timestamps are automatically managed',
                'Notifications support metadata and action URLs',
            ],
        };
    }
};
exports.NotificationsService = NotificationsService;
exports.NotificationsService = NotificationsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], NotificationsService);
//# sourceMappingURL=notifications.service.js.map