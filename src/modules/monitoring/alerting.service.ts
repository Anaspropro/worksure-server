import { Injectable, Logger } from '@nestjs/common';
import { AlertProvider } from './alert-provider.interface';
import { DiscordAlertProvider } from './providers/discord-alert.provider';

interface ActiveIncident {
  incidentKey: string;
  firstTriggeredAt: Date;
  lastAlertSentAt: Date;
  title: string;
}

@Injectable()
export class AlertingService {
  private readonly logger = new Logger(AlertingService.name);
  private activeIncidents: Map<string, ActiveIncident> = new Map();
  private providers: AlertProvider[] = [];

  // 10 minutes default cooldown for deduplication
  private readonly COOLDOWN_MS = 10 * 60 * 1000;

  constructor(private readonly discordProvider: DiscordAlertProvider) {
    this.providers.push(this.discordProvider);
  }

  async sendCriticalAlert(incidentKey: string, title: string, message: string, metadata?: Record<string, any>) {
    await this.processAlert(incidentKey, title, message, 'critical', metadata);
  }

  async sendFatalAlert(incidentKey: string, title: string, message: string, metadata?: Record<string, any>) {
    await this.processAlert(incidentKey, title, message, 'fatal', metadata);
  }

  async sendErrorAlert(incidentKey: string, title: string, message: string, metadata?: Record<string, any>) {
    await this.processAlert(incidentKey, title, message, 'error', metadata);
  }

  private async processAlert(
    incidentKey: string, 
    title: string, 
    message: string, 
    severity: 'error' | 'critical' | 'fatal',
    metadata?: Record<string, any>
  ) {
    const now = new Date();
    const existingIncident = this.activeIncidents.get(incidentKey);

    if (existingIncident) {
      const timeSinceLastAlert = now.getTime() - existingIncident.lastAlertSentAt.getTime();
      
      if (timeSinceLastAlert < this.COOLDOWN_MS) {
        // Suppress deduplicated alert
        this.logger.debug(`Alert suppressed for incident key: ${incidentKey} (cooldown)`);
        return;
      }
      
      // We've surpassed cooldown, update last alert time but keep the original firstTriggeredAt
      existingIncident.lastAlertSentAt = now;
      this.activeIncidents.set(incidentKey, existingIncident);
    } else {
      // New incident
      this.activeIncidents.set(incidentKey, {
        incidentKey,
        firstTriggeredAt: now,
        lastAlertSentAt: now,
        title,
      });
    }

    const payload = {
      incidentKey,
      title,
      message,
      severity,
      metadata,
      timestamp: now,
    };

    // Dispatch to all registered providers
    const promises = this.providers.map(provider => 
      provider.sendAlert(payload).catch(err => {
        this.logger.error(`AlertProvider failed to send alert`, err);
      })
    );

    await Promise.all(promises);
  }

  async resolveAlert(incidentKey: string, recoveryMessage: string) {
    const existingIncident = this.activeIncidents.get(incidentKey);
    if (!existingIncident) {
      // No active incident tracked, nothing to resolve
      return;
    }

    const now = new Date();
    const downtimeMs = now.getTime() - existingIncident.firstTriggeredAt.getTime();

    const payload = {
      incidentKey,
      title: existingIncident.title,
      message: recoveryMessage,
      downtimeMs,
      timestamp: now,
    };

    // Dispatch recovery to all providers
    const promises = this.providers.map(provider => 
      provider.sendRecovery(payload).catch(err => {
        this.logger.error(`AlertProvider failed to send recovery`, err);
      })
    );

    await Promise.all(promises);

    // Clear incident from tracking map
    this.activeIncidents.delete(incidentKey);
  }
}
