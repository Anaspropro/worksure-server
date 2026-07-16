import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { DeliveryStatus } from '../../../generated/prisma';
import { NotificationsGateway } from '../notifications.gateway';
import { RouteNotificationJob } from './notification-routing.processor';
import { NotificationTemplateService } from '../notification-template.service';

interface InAppDeliveryJob extends RouteNotificationJob {
  attemptId: string;
  notificationId: string;
}

@Injectable()
@Processor('in-app-delivery-queue')
export class InAppDeliveryProcessor extends WorkerHost {
  private readonly logger = new Logger(InAppDeliveryProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly gateway: NotificationsGateway,
    private readonly templateService: NotificationTemplateService,
  ) {
    super();
  }

  async process(job: Job<InAppDeliveryJob, any, string>): Promise<any> {
    const { attemptId, notificationId, userId, type, payload } = job.data;
    
    try {
      await this.prisma.deliveryAttempt.update({
        where: { id: attemptId },
        data: { status: DeliveryStatus.PROCESSING }
      });

      // Render content based on template
      // Fallback to basic rendering if template missing
      let title = payload?.title || type;
      let message = payload?.message || `New notification: ${type}`;
      
      try {
        const rendered = await this.templateService.render(type, 'IN_APP', 'en', payload);
        title = rendered.subject || title;
        message = rendered.content;
      } catch (e) {
        this.logger.debug(`Template not found for ${type}, using fallback`);
      }

      // We emit the rendered payload via WebSocket
      const wssPayload = {
        id: notificationId,
        type,
        title,
        message,
        payload,
        createdAt: new Date().toISOString()
      };

      this.gateway.emitToUser(userId, 'newNotification', wssPayload);

      await this.prisma.deliveryAttempt.update({
        where: { id: attemptId },
        data: { 
          status: DeliveryStatus.DELIVERED,
          deliveredAt: new Date()
        }
      });

    } catch (error: any) {
      this.logger.error(`Failed to deliver InApp notification ${notificationId}`, error.stack);
      
      await this.prisma.deliveryAttempt.update({
        where: { id: attemptId },
        data: { 
          status: DeliveryStatus.FAILED,
          error: error.message
        }
      });
      throw error; // Let BullMQ retry
    }
  }
}
