import { Controller, Get, Post, Query, Param, UseGuards, Res } from '@nestjs/common';
import { AuditService } from './audit.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../../common/constants/roles.constants';
import { Response } from 'express';

@Controller('admin/audit')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  @Get()
  async getAuditLogs(
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '20',
    @Query('domain') domain?: any,
    @Query('actorType') actorType?: any,
    @Query('targetType') targetType?: string,
    @Query('actorId') actorId?: string,
  ) {
    const skip = (Number(page) - 1) * Number(limit);
    const take = Number(limit);

    const where: any = {};
    if (domain) where.domain = domain;
    if (actorType) where.actorType = actorType;
    if (targetType) where.targetType = targetType;
    if (actorId) where.actorId = actorId;

    const [data, total] = await Promise.all([
      this.auditService.getAuditEvents({
        skip,
        take,
        where,
        orderBy: { timestamp: 'desc' },
      }),
      this.auditService.countAuditEvents(where),
    ]);

    return {
      data,
      meta: {
        total,
        page: Number(page),
        limit: take,
        totalPages: Math.ceil(total / take),
      },
    };
  }

  @Get('timeline/:targetType/:targetId')
  async getTimeline(
    @Param('targetType') targetType: string,
    @Param('targetId') targetId: string,
  ) {
    return this.auditService.getTimeline(targetType, targetId);
  }

  @Post('export')
  async exportAuditLogs(@Query() filters: any, @Res() res: Response) {
    // Basic CSV Export implementation for compliance
    const data = await this.auditService.getAuditEvents({
      where: filters, // Simplified for now
      orderBy: { timestamp: 'desc' },
    });

    const csvHeaders = 'ID,Timestamp,Domain,Action,ActorType,ActorId,TargetType,TargetId,CorrelationId,Severity\n';
    const csvRows = data.map(evt => 
      `${evt.id},${evt.timestamp.toISOString()},${evt.domain},${evt.action},${evt.actorType},${evt.actorId || ''},${evt.targetType},${evt.targetId},${evt.correlationId},${evt.severity}`
    ).join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=audit-export.csv');
    res.send(csvHeaders + csvRows);
  }
}
