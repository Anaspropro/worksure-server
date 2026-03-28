import { PrismaService } from '../../database/prisma.service';
import { NotificationType, NotificationPriority } from './dto/notification.dto';
export declare class NotificationsService {
    private readonly prisma;
    constructor(prisma: PrismaService);
    createNotification(userId: string, title: string, message: string): Promise<{
        id: string;
        createdAt: Date;
        message: string;
        title: string;
        userId: string;
    }>;
    updateNotification(notificationId: string, userId: string, actionUrl?: string, metadata?: Record<string, any>): Promise<{
        id: string;
        createdAt: Date;
        message: string;
        title: string;
        userId: string;
    }>;
    getNotificationsByUser(userId: string, filters?: {
        dateFrom?: Date;
        dateTo?: Date;
    }, pagination?: {
        page?: number;
        limit?: number;
    }): Promise<{
        notifications: {
            id: string;
            createdAt: Date;
            message: string;
            title: string;
            userId: string;
        }[];
        pagination: {
            page: number;
            limit: number;
            total: number;
            totalPages: number;
            hasNext: boolean;
            hasPrev: boolean;
        };
    }>;
    getNotificationById(notificationId: string, userId?: string): Promise<{
        id: string;
        createdAt: Date;
        message: string;
        title: string;
        userId: string;
    }>;
    markNotificationsAsRead(userId: string, notificationIds: string[], isAdmin?: boolean): Promise<number>;
    markAllAsRead(userId: string): Promise<number>;
    deleteNotification(notificationId: string, userId: string, isAdmin?: boolean): Promise<boolean>;
    getNotificationStats(userId: string): Promise<{
        total: number;
        unread: number;
        archived: number;
        byType: Record<NotificationType, number>;
        byPriority: Record<NotificationPriority, number>;
    }>;
    createProposalNotification(userId: string, type: 'proposal_received' | 'proposal_accepted' | 'proposal_rejected' | 'proposal_withdrawn', proposalId: string, jobTitle: string, artisanName?: string): Promise<{
        id: string;
        createdAt: Date;
        message: string;
        title: string;
        userId: string;
    }>;
    createContractNotification(userId: string, type: 'contract_created' | 'contract_funded' | 'contract_started' | 'contract_completed', contractId: string, jobTitle: string): Promise<{
        id: string;
        createdAt: Date;
        message: string;
        title: string;
        userId: string;
    }>;
    createDisputeNotification(userId: string, type: 'dispute_created' | 'dispute_resolved', disputeId: string, contractTitle: string): Promise<{
        id: string;
        createdAt: Date;
        message: string;
        title: string;
        userId: string;
    }>;
    createReviewNotification(userId: string, reviewId: string, jobTitle: string, rating: number): Promise<{
        id: string;
        createdAt: Date;
        message: string;
        title: string;
        userId: string;
    }>;
    getDefinition(): {
        name: string;
        description: string;
        responsibilities: string[];
        rules: string[];
    };
}
