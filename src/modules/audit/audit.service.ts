import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { RedactionService } from './redaction.service';
import { AuditDomain, AuditActorType, AuditSeverity, Prisma } from '@prisma/client';

@Injectable()
export class AuditService {
  constructor(
    private prisma: PrismaService,
    private redactionService: RedactionService,
  ) {}

  async createAuditLog(data: {
    domain: AuditDomain;
    action: string;
    actorType: AuditActorType;
    actorId: string | null;
    targetType: string;
    targetId: string;
    metadata: any;
    severity: AuditSeverity;
    correlationId: string;
    ipAddress: string | null;
    userAgent: string | null;
  }) {
    const redactedMetadata = this.redactionService.redact(data.metadata);

    return this.prisma.auditEvent.create({
      data: {
        ...data,
        metadata: redactedMetadata as Prisma.JsonObject,
      },
    });
  }

  async getAuditEvents(params: {
    skip?: number;
    take?: number;
    where?: Prisma.AuditEventWhereInput;
    orderBy?: Prisma.AuditEventOrderByWithRelationInput;
  }) {
    const { skip, take, where, orderBy } = params;
    return this.prisma.auditEvent.findMany({
      skip,
      take,
      where,
      orderBy,
    });
  }

  async countAuditEvents(where?: Prisma.AuditEventWhereInput) {
    return this.prisma.auditEvent.count({ where });
  }

  async getTimeline(targetType: string, targetId: string) {
    return this.prisma.auditEvent.findMany({
      where: { targetType, targetId },
      orderBy: { timestamp: 'asc' },
    });
  }
}
