import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { NotificationPriority, NotificationChannel } from '../../generated/prisma';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';

@Injectable()
export class NotificationsService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(CACHE_MANAGER) private readonly cacheManager: Cache,
  ) {}

  async listNotifications(userId: string, page = 1, limit = 20) {
    const take = Math.min(limit, 100);
    const skip = (page - 1) * take;

    const [items, total] = await Promise.all([
      this.prisma.notification.findMany({
        where: { userId },
        skip,
        take,
        orderBy: { createdAt: 'desc' },
        include: { deliveries: true },
      }),
      this.prisma.notification.count({ where: { userId } }),
    ]);

    return {
      data: items,
      pagination: {
        page,
        limit: take,
        total,
        totalPages: Math.ceil(total / take),
        hasNext: page * take < total,
        hasPrev: page > 1,
      },
    };
  }

  async markAsRead(userId: string, notificationIds: string[]) {
    const result = await this.prisma.notification.updateMany({
      where: {
        userId,
        id: { in: notificationIds },
        readAt: null,
      },
      data: {
        readAt: new Date(),
      },
    });
    
    if (result.count > 0) {
      await this.cacheManager.del(`notifications:unreadCount:${userId}`);
    }
    return result;
  }

  async markAllAsRead(userId: string) {
    const result = await this.prisma.notification.updateMany({
      where: {
        userId,
        readAt: null,
      },
      data: {
        readAt: new Date(),
      },
    });
    
    if (result.count > 0) {
      await this.cacheManager.set(`notifications:unreadCount:${userId}`, 0);
    }
    return result;
  }

  async getUnreadCount(userId: string) {
    const cacheKey = `notifications:unreadCount:${userId}`;
    const cachedCount = await this.cacheManager.get<number>(cacheKey);
    
    if (cachedCount !== undefined && cachedCount !== null) {
      return cachedCount;
    }

    const count = await this.prisma.notification.count({
      where: {
        userId,
        readAt: null,
      },
    });
    
    // Cache for 5 minutes
    await this.cacheManager.set(cacheKey, count, 300000);
    return count;
  }

  async getPreferences(userId: string) {
    return this.prisma.notificationPreference.findMany({
      where: { userId },
    });
  }

  async updatePreference(
    userId: string, 
    channel: NotificationChannel, 
    category: string, 
    enabled: boolean
  ) {
    return this.prisma.notificationPreference.upsert({
      where: {
        userId_channel_category: {
          userId,
          channel,
          category,
        },
      },
      update: { enabled },
      create: {
        userId,
        channel,
        category,
        enabled,
      },
    });
  }
}
