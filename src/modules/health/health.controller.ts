import * as fs from 'node:fs';
import * as os from 'node:os';
import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { PrismaService } from '../../database/prisma.service';
import { AppConfigService } from '../../config/app-config.service';

@ApiTags('Health')
@Controller('health')
export class HealthController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: AppConfigService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Basic health check' })
  @ApiResponse({ status: 200, description: 'Service is healthy' })
  async health() {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      environment: this.configService.nodeEnv || 'development',
    };
  }

  @Get('ready')
  @ApiOperation({ summary: 'Readiness check - includes database connectivity' })
  @ApiResponse({ status: 200, description: 'Service is ready' })
  @ApiResponse({ status: 503, description: 'Service is not ready' })
  async readiness() {
    try {
      // Check database connectivity
      await this.prisma.$queryRaw`SELECT 1`;
      return {
        status: 'ready',
        timestamp: new Date().toISOString(),
        checks: {
          database: 'ok',
          memory: this.getMemoryStatus(),
          disk: this.getDiskStatus(),
        },
      };
    } catch (error) {
      return {
        status: 'not ready',
        timestamp: new Date().toISOString(),
        error: error instanceof Error ? error.message : String(error),
        checks: {
          database: 'error',
          memory: this.getMemoryStatus(),
          disk: this.getDiskStatus(),
        },
      };
    }
  }

  @Get('live')
  @ApiOperation({ summary: 'Liveness check' })
  @ApiResponse({ status: 200, description: 'Service is alive' })
  async liveness() {
    return {
      status: 'alive',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    };
  }

  private getMemoryStatus() {
    const usage = process.memoryUsage();
    const totalMemory = os.totalmem();
    const freeMemory = os.freemem();

    return {
      used: Math.round((usage.heapUsed / 1024 / 1024) * 100) / 100, // MB
      total: Math.round((usage.heapTotal / 1024 / 1024) * 100) / 100, // MB
      external: Math.round((usage.external / 1024 / 1024) * 100) / 100, // MB
      system: {
        total: Math.round((totalMemory / 1024 / 1024) * 100) / 100, // MB
        free: Math.round((freeMemory / 1024 / 1024) * 100) / 100, // MB
        usagePercent: Math.round(
          ((totalMemory - freeMemory) / totalMemory) * 100,
        ),
      },
    };
  }

  private getDiskStatus() {
    try {
      fs.statSync('.');

      return {
        available: 'unknown', // Would need additional library for detailed disk info
        status: 'ok',
      };
    } catch (error) {
      return {
        status: 'error',
        error: error.message,
      };
    }
  }
}
