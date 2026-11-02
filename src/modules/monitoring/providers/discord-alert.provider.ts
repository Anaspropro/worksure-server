import { Injectable, Logger } from '@nestjs/common';
import {
  AlertProvider,
  AlertPayload,
  RecoveryPayload,
} from '../alert-provider.interface';
import { AppConfigService } from '../../../config/app-config.service';

@Injectable()
export class DiscordAlertProvider implements AlertProvider {
  private readonly logger = new Logger(DiscordAlertProvider.name);

  constructor(private configService: AppConfigService) {}

  private async sendWebhook(embeds: any[]) {
    const url = this.configService.discordWebhookUrl;
    if (!url) {
      this.logger.warn('Discord webhook URL not configured. Alert suppressed.');
      return;
    }

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ embeds }),
      });

      if (!response.ok) {
        this.logger.error(`Discord webhook failed: ${response.statusText}`);
      }
    } catch (error) {
      this.logger.error('Failed to send Discord alert', error);
    }
  }

  async sendAlert(payload: AlertPayload): Promise<void> {
    const colorMap = {
      error: 16753920, // Orange
      critical: 16711680, // Red
      fatal: 10027008, // Dark Red
    };

    const embed = {
      title: `🚨 ALERT: ${payload.title}`,
      description: payload.message,
      color: colorMap[payload.severity] || 16711680,
      timestamp: payload.timestamp.toISOString(),
      fields: [] as any[],
    };

    if (payload.metadata && Object.keys(payload.metadata).length > 0) {
      embed.fields.push({
        name: 'Metadata',
        value:
          '```json\n' +
          JSON.stringify(payload.metadata, null, 2).substring(0, 1000) +
          '\n```',
        inline: false,
      });
    }

    embed.fields.push({
      name: 'Incident Key',
      value: `\`${payload.incidentKey}\``,
      inline: true,
    });

    embed.fields.push({
      name: 'Severity',
      value: `\`${payload.severity.toUpperCase()}\``,
      inline: true,
    });

    await this.sendWebhook([embed]);
  }

  async sendRecovery(payload: RecoveryPayload): Promise<void> {
    // Format downtime gracefully
    const seconds = Math.floor((payload.downtimeMs / 1000) % 60);
    const minutes = Math.floor((payload.downtimeMs / (1000 * 60)) % 60);
    const hours = Math.floor(payload.downtimeMs / (1000 * 60 * 60));

    const downtimeParts: string[] = [];
    if (hours > 0) downtimeParts.push(`${hours}h`);
    if (minutes > 0) downtimeParts.push(`${minutes}m`);
    downtimeParts.push(`${seconds}s`);
    const formattedDowntime = downtimeParts.join(' ');

    const embed = {
      title: `✅ RECOVERY: ${payload.title}`,
      description: `${payload.message}\n\n**Restored after ${formattedDowntime}**`,
      color: 65280, // Green
      timestamp: payload.timestamp.toISOString(),
      fields: [
        {
          name: 'Incident Key',
          value: `\`${payload.incidentKey}\``,
          inline: true,
        },
        {
          name: 'Downtime',
          value: `\`${formattedDowntime}\``,
          inline: true,
        },
      ],
    };

    await this.sendWebhook([embed]);
  }
}
