import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job, Queue } from 'bullmq';
import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { InjectQueue } from '@nestjs/bullmq';
import { NotificationChannel, NotificationPriority, DeliveryStatus } from '../../../generated/prisma';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { Inject } from '@nestjs/common';

export interface RouteNotificationJob {
  type: string;
  category: string;
  userId: string;
  payload: any;
  priority: NotificationPriority;
}

@Injectable()
@Processor('notification-routing-queue')
export class NotificationRoutingProcessor extends WorkerHost {
  private readonly logger = new Logger(NotificationRoutingProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    @InjectQueue('email-delivery-queue') private readonly emailQueue: Queue,
    @InjectQueue('in-app-delivery-queue') private readonly inAppQueue: Queue,
    @Inject(CACHE_MANAGER) private readonly cacheManager: Cache,
  ) {
    super();
  }

  async process(job: Job<RouteNotificationJob, any, string>): Promise<any> {
    const { type, category, userId, payload, priority } = job.data;
    
    // 1. Create the base Notification aggregate
    const notification = await this.prisma.notification.create({
      data: {
        type,
        category,
        userId,
        priority,
        payload: payload || {},
        entityId: payload?.entityId || payload?.id,
        entityType: payload?.entityType || category,
      }
    });

    // Invalidate unread count cache
    await this.cacheManager.del(`notifications:unreadCount:${userId}`);

    // 2. Fetch User Preferences
    // In V1, we assume all users get IN_APP and EMAIL unless explicitly opted out
    const prefs = await this.prisma.notificationPreference.findMany({
      where: { userId, category }
    });

    const isChannelEnabled = (channel: NotificationChannel) => {
      // Critical priority ignores preferences
      if (priority === NotificationPriority.CRITICAL) return true;
      const pref = prefs.find(p => p.channel === channel);
      return pref ? pref.enabled : true;
    };

    // 3. Dispatch to Channels
    const dispatchPromises: Promise<any>[] = [];

    if (isChannelEnabled(NotificationChannel.IN_APP)) {
      dispatchPromises.push(this.dispatchToChannel(notification.id, NotificationChannel.IN_APP, this.inAppQueue, job.data));
    }

    if (isChannelEnabled(NotificationChannel.EMAIL)) {
      dispatchPromises.push(this.dispatchToChannel(notification.id, NotificationChannel.EMAIL, this.emailQueue, job.data));
    }

    await Promise.all(dispatchPromises);
    
    return { notificationId: notification.id, channels: dispatchPromises.length };
  }

  private async dispatchToChannel(notificationId: string, channel: NotificationChannel, queue: Queue, data: RouteNotificationJob) {
    // Create DeliveryAttempt record
    const attempt = await this.prisma.deliveryAttempt.create({
      data: {
        notificationId,
        channel,
        status: DeliveryStatus.QUEUED
      }
    });

    // Push to actual delivery queue
    await queue.add('deliver', {
      attemptId: attempt.id,
      notificationId,
      ...data
    }, {
      removeOnComplete: true,
      attempts: 3,
      backoff: { type: 'exponential', delay: 2000 }
    });
  }
}
