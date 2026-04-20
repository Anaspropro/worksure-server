import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../../database/prisma.service';
import {
  CreateNotificationDto,
  MarkNotificationsDto,
  NotificationListQueryDto,
  NotificationPriority,
  NotificationStatsDto,
  NotificationType,
  UpdateNotificationDto,
} from './dto/notification.dto';

@Injectable()
export class NotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  private async ensureUserExists(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true },
    });

    if (!user) {
      throw new BadRequestException('Target user not found');
    }
  }

  private toResponse(notification: any) {
    return {
      id: notification.id,
      userId: notification.userId,
      type: notification.type as NotificationType,
      title: notification.title,
      message: notification.message,
      entityId: notification.entityId ?? undefined,
      entityType: notification.entityType ?? undefined,
      actionUrl: notification.actionUrl ?? undefined,
      priority: notification.priority as NotificationPriority,
      isRead: notification.read,
      isArchived: notification.isArchived,
      metadata:
        notification.metadata &&
        typeof notification.metadata === 'object' &&
        !Array.isArray(notification.metadata)
          ? notification.metadata
          : undefined,
      createdAt: notification.createdAt.toISOString(),
      readAt: notification.readAt?.toISOString() ?? undefined,
      archivedAt: notification.archivedAt?.toISOString() ?? undefined,
    };
  }

  async createNotification(dto: CreateNotificationDto) {
    await this.ensureUserExists(dto.userId);

    const notification = await this.prisma.notification.create({
      data: {
        id: randomUUID(),
        userId: dto.userId,
        type: dto.type,
        title: dto.title,
        message: dto.message,
        entityId: dto.entityId || null,
        entityType: dto.entityType || null,
        actionUrl: dto.actionUrl || null,
        priority: dto.priority || NotificationPriority.MEDIUM,
        metadata: dto.metadata || undefined,
        createdAt: new Date(),
      },
    });

    return this.toResponse(notification);
  }

  async listNotifications(
    actor: { id: string; role: string },
    query: NotificationListQueryDto,
  ) {
    const {
      page = 1,
      limit = 20,
      type,
      priority,
      isRead,
      isArchived,
      entityId,
      entityType,
      dateFrom,
      dateTo,
    } = query;

    const where: any = {};

    if (actor.role !== 'ADMIN') {
      where.userId = actor.id;
    }

    if (type) where.type = type;
    if (priority) where.priority = priority;
    if (typeof isRead === 'string') where.read = isRead === 'true';
    if (typeof isArchived === 'string')
      where.isArchived = isArchived === 'true';
    if (entityId) where.entityId = entityId;
    if (entityType) where.entityType = entityType;
    if (dateFrom || dateTo) {
      where.createdAt = {
        gte: dateFrom ? new Date(dateFrom) : undefined,
        lte: dateTo ? new Date(dateTo) : undefined,
      };
    }

    const skip = (page - 1) * limit;
    const take = Math.min(limit, 100);

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
      notifications: notifications.map((notification) =>
        this.toResponse(notification),
      ),
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

  async getNotificationById(
    notificationId: string,
    actor?: { id: string; role: string },
  ) {
    const notification = await this.prisma.notification.findUnique({
      where: { id: notificationId },
    });

    if (!notification) {
      throw new NotFoundException('Notification not found');
    }

    if (
      actor &&
      actor.role !== 'ADMIN' &&
      notification.userId !== actor.id
    ) {
      throw new BadRequestException(
        'Access denied: You can only view your own notifications',
      );
    }

    return this.toResponse(notification);
  }

  async updateNotification(
    notificationId: string,
    actor: { id: string; role: string },
    updateDto: UpdateNotificationDto,
  ) {
    const notification = await this.prisma.notification.findUnique({
      where: { id: notificationId },
    });

    if (!notification) {
      throw new NotFoundException('Notification not found');
    }

    if (actor.role !== 'ADMIN' && notification.userId !== actor.id) {
      throw new BadRequestException(
        'You can only update your own notifications',
      );
    }

    const markRead =
      updateDto.isRead === true && notification.read === false
        ? new Date()
        : updateDto.isRead === false
          ? null
          : undefined;

    const markArchived =
      updateDto.isArchived === true && notification.isArchived === false
        ? new Date()
        : updateDto.isArchived === false
          ? null
          : undefined;

    const updated = await this.prisma.notification.update({
      where: { id: notificationId },
      data: {
        actionUrl:
          updateDto.actionUrl !== undefined ? updateDto.actionUrl : undefined,
        metadata:
          updateDto.metadata !== undefined ? updateDto.metadata : undefined,
        read: updateDto.isRead ?? undefined,
        readAt: markRead,
        isArchived: updateDto.isArchived ?? undefined,
        archivedAt: markArchived,
      },
    });

    return this.toResponse(updated);
  }

  async markNotifications(
    actor: { id: string; role: string },
    dto: MarkNotificationsDto,
  ) {
    const where: any = {
      id: {
        in: dto.notificationIds,
      },
    };

    if (actor.role !== 'ADMIN') {
      where.userId = actor.id;
    }

    const items = await this.prisma.notification.findMany({ where });

    if (items.length === 0) {
      return { updated: 0 };
    }

    const readAt =
      dto.markAsRead === true ? new Date() : dto.markAsRead === false ? null : undefined;
    const archivedAt =
      dto.markAsArchived === true
        ? new Date()
        : dto.markAsArchived === false
          ? null
          : undefined;

    const result = await this.prisma.notification.updateMany({
      where,
      data: {
        read: dto.markAsRead ?? undefined,
        readAt,
        isArchived: dto.markAsArchived ?? undefined,
        archivedAt,
      },
    });

    return { updated: result.count };
  }

  async markAllAsRead(userId: string) {
    const result = await this.prisma.notification.updateMany({
      where: {
        userId,
        read: false,
      },
      data: {
        read: true,
        readAt: new Date(),
      },
    });

    return { updated: result.count };
  }

  async deleteNotification(
    notificationId: string,
    actor: { id: string; role: string },
  ) {
    const notification = await this.prisma.notification.findUnique({
      where: { id: notificationId },
    });

    if (!notification) {
      throw new NotFoundException('Notification not found');
    }

    if (actor.role !== 'ADMIN' && notification.userId !== actor.id) {
      throw new BadRequestException(
        'You can only delete your own notifications',
      );
    }

    await this.prisma.notification.delete({
      where: { id: notificationId },
    });

    return { deleted: true };
  }

  async getNotificationStats(userId: string): Promise<NotificationStatsDto> {
    const notifications = await this.prisma.notification.findMany({
      where: { userId },
    });

    const byType = Object.fromEntries(
      Object.values(NotificationType).map((type) => [
        type,
        notifications.filter((notification) => notification.type === type)
          .length,
      ]),
    ) as Record<NotificationType, number>;

    const byPriority = Object.fromEntries(
      Object.values(NotificationPriority).map((priority) => [
        priority,
        notifications.filter(
          (notification) => notification.priority === priority,
        ).length,
      ]),
    ) as Record<NotificationPriority, number>;

    return {
      total: notifications.length,
      unread: notifications.filter((notification) => !notification.read).length,
      archived: notifications.filter((notification) => notification.isArchived)
        .length,
      byType,
      byPriority,
    };
  }

  async createProposalNotification(
    userId: string,
    type:
      | NotificationType.PROPOSAL_RECEIVED
      | NotificationType.PROPOSAL_ACCEPTED
      | NotificationType.PROPOSAL_REJECTED
      | NotificationType.PROPOSAL_WITHDRAWN,
    proposalId: string,
    jobTitle: string,
    artisanName?: string,
  ) {
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

    return this.createNotification({
      userId,
      type,
      title: titles[type],
      message: messages[type],
      entityId: proposalId,
      entityType: 'proposal',
      priority: NotificationPriority.MEDIUM,
    });
  }

  async createContractNotification(
    userId: string,
    type:
      | NotificationType.CONTRACT_CREATED
      | NotificationType.CONTRACT_FUNDED
      | NotificationType.CONTRACT_STARTED
      | NotificationType.CONTRACT_COMPLETED,
    contractId: string,
    jobTitle: string,
  ) {
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

    return this.createNotification({
      userId,
      type,
      title: titles[type],
      message: messages[type],
      entityId: contractId,
      entityType: 'contract',
      priority: NotificationPriority.HIGH,
    });
  }

  async createDisputeNotification(
    userId: string,
    type:
      | NotificationType.DISPUTE_CREATED
      | NotificationType.DISPUTE_RESOLVED,
    disputeId: string,
    contractTitle: string,
  ) {
    const titles = {
      dispute_created: 'Dispute Created',
      dispute_resolved: 'Dispute Resolved',
    };

    const messages = {
      dispute_created: `A dispute has been created for "${contractTitle}"`,
      dispute_resolved: `The dispute for "${contractTitle}" has been resolved`,
    };

    return this.createNotification({
      userId,
      type,
      title: titles[type],
      message: messages[type],
      entityId: disputeId,
      entityType: 'dispute',
      priority: NotificationPriority.HIGH,
    });
  }

  async createReviewNotification(
    userId: string,
    reviewId: string,
    jobTitle: string,
    rating: number,
  ) {
    return this.createNotification({
      userId,
      type: NotificationType.REVIEW_RECEIVED,
      title: 'New Review Received',
      message: `You received a ${rating}-star review for "${jobTitle}"`,
      entityId: reviewId,
      entityType: 'review',
      priority: NotificationPriority.MEDIUM,
    });
  }
}
