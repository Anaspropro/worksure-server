import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class AuditService {
  constructor(private prisma: PrismaService) {}

  async getAuditLogs(params: {
    skip?: number;
    take?: number;
    where?: any;
    orderBy?: any;
  }) {
    const { skip, take, where, orderBy } = params;
    return this.prisma.auditLog.findMany({
      skip,
      take,
      where,
      orderBy,
    });
  }

  async countAuditLogs(where?: any) {
    return this.prisma.auditLog.count({ where });
  }
}
