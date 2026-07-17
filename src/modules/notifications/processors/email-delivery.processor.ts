import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { DeliveryStatus } from '../../../generated/prisma';
import { EmailService } from '../../../common/services/email.service';
import { RouteNotificationJob } from './notification-routing.processor';
import { NotificationTemplateService } from '../notification-template.service';

interface EmailDeliveryJob extends RouteNotificationJob {
  attemptId: string;
  notificationId: string;
}

@Injectable()
@Processor('email-delivery-queue')
export class EmailDeliveryProcessor extends WorkerHost {
  private readonly logger = new Logger(EmailDeliveryProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly emailService: EmailService,
    private readonly templateService: NotificationTemplateService,
  ) {
    super();
  }

  async process(job: Job<EmailDeliveryJob, any, string>): Promise<any> {
    const { attemptId, notificationId, userId, type, payload } = job.data;
    
    try {
      await this.prisma.deliveryAttempt.update({
        where: { id: attemptId },
        data: { status: DeliveryStatus.PROCESSING }
      });

      // Get user email
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { email: true, name: true }
      });

      if (!user?.email) {
        throw new Error(`User ${userId} has no email address`);
      }

      // Render content based on template
      let subject = payload?.title || `WorkSure: ${type}`;
      let html = payload?.message || `<p>New notification: ${type}</p>`;
      
      try {
        const rendered = await this.templateService.render(type, 'EMAIL', 'en', { ...payload, userName: user.name });
        subject = rendered.subject || subject;
        html = rendered.content;
      } catch (e) {
        this.logger.debug(`Template not found for ${type}, using fallback`);
      }

      await this.emailService.sendEmail({
        to: user.email,
        subject,
        html,
      });

      await this.prisma.deliveryAttempt.update({
        where: { id: attemptId },
        data: { 
          status: DeliveryStatus.DELIVERED,
          deliveredAt: new Date()
        }
      });

    } catch (error: any) {
      this.logger.error(`Failed to deliver Email notification ${notificationId}`, error.stack);
      
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
