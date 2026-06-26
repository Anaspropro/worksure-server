import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class MonitoringService {
  private readonly logger = new Logger(MonitoringService.name);

  constructor(private prisma: PrismaService) {}

  async getHealth() {
    let dbStatus = 'disconnected';
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      dbStatus = 'connected';
    } catch (e) {
      this.logger.error('Database connection check failed', e.stack);
    }

    return {
      status: dbStatus === 'connected' ? 'ok' : 'error',
      timestamp: new Date().toISOString(),
      services: {
        database: {
          status: dbStatus,
        },
      },
      metrics: {
        memory: process.memoryUsage(),
        uptime: process.uptime(),
      },
    };
  }

  async getSystemLogs(params: {
    skip?: number;
    take?: number;
    where?: any;
    orderBy?: any;
  }) {
    const { skip, take, where, orderBy } = params;
    return this.prisma.systemLog.findMany({
      skip,
      take,
      where,
      orderBy,
    });
  }

  async countSystemLogs(where?: any) {
    return this.prisma.systemLog.count({ where });
  }

  async createSystemLog(data: { level: string; message: string; context?: string; trace?: string; metadata?: any }) {
    if (['info', 'debug'].includes(data.level.toLowerCase())) {
      // Ignore routine info/debug logs from being saved to the database to save space
      return;
    }

    try {
      await this.prisma.systemLog.create({
        data,
      });
    } catch (e) {
      // Fallback to console if DB fails
      console.error('Failed to write to SystemLog', e);
    }
  }

  async clearSystemLogs() {
    return this.prisma.systemLog.deleteMany({});
  }
}
