import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { AuditService } from './audit.service';
import { auditContextStorage } from '../../common/middleware/audit-context.middleware';
import {
  AuditDomain,
  AuditActorType,
  AuditSeverity,
} from '../../generated/prisma';

export interface BaseDomainEvent {
  domain: AuditDomain;
  action: string;
  actorType: AuditActorType;
  actorId?: string;
  targetType: string;
  targetId: string;
  metadata?: any;
  severity?: AuditSeverity;
}

@Injectable()
export class AuditListener {
  private readonly logger = new Logger(AuditListener.name);

  constructor(private readonly auditService: AuditService) {}

  @OnEvent('**', { async: true }) // Catch all events
  async handleAllEvents(event: BaseDomainEvent | any) {
    // Only process events that conform to the BaseDomainEvent structure
    if (
      !event ||
      !event.domain ||
      !event.action ||
      !event.targetType ||
      !event.targetId
    ) {
      return;
    }

    try {
      const context = auditContextStorage.getStore();

      const auditPayload = {
        domain: event.domain,
        action: event.action,
        actorType: event.actorType || AuditActorType.SYSTEM,
        actorId: event.actorId || context?.userId || null,
        targetType: event.targetType,
        targetId: event.targetId,
        metadata: event.metadata || {},
        severity: event.severity || AuditSeverity.INFO,
        correlationId: context?.correlationId || 'system-generated',
        ipAddress: context?.ipAddress || null,
        userAgent: context?.userAgent || null,
      };

      await this.auditService.createAuditLog(auditPayload);
    } catch (error) {
      // Fire and forget - do not crash the business logic!
      this.logger.error(
        `Failed to record audit event: ${error.message}`,
        error.stack,
      );
    }
  }
}
