import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class DiscordWebhookService {
  private readonly logger = new Logger(DiscordWebhookService.name);
  private readonly webhookUrl: string | undefined;

  constructor(private configService: ConfigService) {
    this.webhookUrl = this.configService.get<string>('DISCORD_WEBHOOK_URL');
  }

  async sendNotification(message: string, embed?: any) {
    if (!this.webhookUrl) {
      this.logger.debug('Discord webhook URL not configured, skipping notification');
      return;
    }

    try {
      const payload = {
        content: message,
        ...(embed && { embeds: [embed] }),
      };

      const response = await fetch(this.webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        this.logger.error(`Failed to send Discord webhook: ${response.statusText}`);
      }
    } catch (error) {
      this.logger.error('Error sending Discord webhook', error);
    }
  }
}
