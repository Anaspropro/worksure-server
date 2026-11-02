import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { NotificationChannel } from '../../generated/prisma';

export interface RenderedNotification {
  subject?: string;
  content: string;
}

@Injectable()
export class NotificationTemplateService {
  private readonly logger = new Logger(NotificationTemplateService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Interpolates variables into a template string
   * e.g. interpolate('Hello {name}', { name: 'World' }) => 'Hello World'
   */
  private interpolate(
    template: string,
    variables: Record<string, any>,
  ): string {
    return template.replace(/{(\w+)}/g, (match, key) => {
      return variables[key] !== undefined ? variables[key] : match;
    });
  }

  /**
   * Generates the notification content by fetching template from DB
   */
  public async render(
    type: string,
    channel: NotificationChannel,
    locale: string = 'en',
    variables: Record<string, any>,
  ): Promise<RenderedNotification> {
    // Attempt to fetch template from DB
    const template = await this.prisma.notificationTemplate.findUnique({
      where: {
        type_channel_locale: {
          type,
          channel,
          locale,
        },
      },
    });

    if (template) {
      return {
        subject: template.subject
          ? this.interpolate(template.subject, variables)
          : undefined,
        content: this.interpolate(template.content, variables),
      };
    }

    this.logger.warn(
      `No template found for type=${type}, channel=${channel}, locale=${locale}. Falling back.`,
    );

    // Fallbacks
    switch (type) {
      case 'PROPOSAL_RECEIVED':
        return {
          subject: this.interpolate('New Proposal for {jobTitle}', variables),
          content: this.interpolate(
            'You have received a new proposal for {jobTitle}.',
            variables,
          ),
        };
      case 'CONTRACT_FUNDED':
        return {
          subject: this.interpolate('Contract Funded: {jobTitle}', variables),
          content: this.interpolate(
            'The client has funded the escrow for {jobTitle}. You may now begin work.',
            variables,
          ),
        };
      case 'DISPUTE_CREATED':
        return {
          subject: 'Dispute Opened',
          content:
            'A dispute has been opened for your contract. Please review it.',
        };
      case 'MARKETPLACE_VERIFICATION_APPROVED':
        return {
          subject: 'Account Approved!',
          content: 'Congratulations! Your profile has been approved.',
        };
      default:
        return {
          subject: 'New Notification',
          content: 'You have a new notification.',
        };
    }
  }
}
