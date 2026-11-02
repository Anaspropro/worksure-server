import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import {
  HealthCheckService,
  HealthCheck,
  MemoryHealthIndicator,
  PrismaHealthIndicator,
  MicroserviceHealthIndicator,
} from '@nestjs/terminus';
import { PrismaService } from '../../database/prisma.service';
import { AppConfigService } from '../../config/app-config.service';
import { RedisOptions, Transport } from '@nestjs/microservices';
import { AlertingService } from '../monitoring/alerting.service';
import { BullMQHealthIndicator } from './bullmq-health.indicator';

@ApiTags('Health')
@Controller('health')
export class HealthController {
  constructor(
    private health: HealthCheckService,
    private prismaHealth: PrismaHealthIndicator,
    private memory: MemoryHealthIndicator,
    private microservice: MicroserviceHealthIndicator,
    private prisma: PrismaService,
    private configService: AppConfigService,
    private alertingService: AlertingService,
    private bullmqHealth: BullMQHealthIndicator,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Basic health check' })
  @ApiResponse({ status: 200, description: 'Service is healthy' })
  healthCheck() {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      environment: this.configService.nodeEnv || 'development',
    };
  }

  @Get('ready')
  @HealthCheck()
  @ApiOperation({ summary: 'Readiness check - includes database connectivity' })
  @ApiResponse({ status: 200, description: 'Service is ready' })
  @ApiResponse({ status: 503, description: 'Service is not ready' })
  async readiness() {
    const checkPromise = this.health.check([
      () => this.prismaHealth.pingCheck('database', this.prisma, { timeout: 5000 }),
      () => this.memory.checkHeap('memory_heap', 1024 * 1024 * 1024), // 1GB
      () => this.memory.checkRSS('memory_rss', 1024 * 1024 * 1024), // 1GB
      () => {
        const url = new URL(process.env.REDIS_URL || 'redis://localhost:6379');
        return this.microservice.pingCheck<RedisOptions>('redis', {
          transport: Transport.REDIS,
          options: {
            host: url.hostname,
            port: parseInt(url.port || '6379'),
            password: url.password,
            tls:
              url.protocol === 'rediss:'
                ? { rejectUnauthorized: false }
                : undefined,
          },
        });
      },
      () => this.bullmqHealth.isHealthy('queues'),
    ]);

    try {
      const result = await checkPromise;

      // If we reach here, it means all checks passed successfully.
      // Send recovery for components if they were previously failing
      this.alertingService.resolveAlert(
        'health_database',
        'Database connection restored and healthy.',
      );
      this.alertingService.resolveAlert(
        'health_redis',
        'Redis connection restored and healthy.',
      );
      this.alertingService.resolveAlert(
        'health_queues',
        'BullMQ queues restored and healthy.',
      );

      return result;
    } catch (e: any) {
      if (e.response && e.response.details) {
        const details = e.response.details;
        if (details.database?.status === 'down') {
          this.alertingService.sendCriticalAlert(
            'health_database',
            'Database Connection Failure',
            'The health check endpoint failed to connect to the Prisma Database.',
            { details: details.database },
          );
        }
        if (details.redis?.status === 'down') {
          this.alertingService.sendCriticalAlert(
            'health_redis',
            'Redis Connection Failure',
            'The health check endpoint failed to connect to Redis.',
            { details: details.redis },
          );
        }
        if (
          details.queues?.status === 'down' ||
          details.queues?.status === 'backed_up'
        ) {
          this.alertingService.sendCriticalAlert(
            'health_queues',
            'Queue Processing Delay / Down',
            'The health check endpoint detected that queues are offline or backed up.',
            { details: details.queues },
          );
        }
      }
      throw e;
    }
  }

  @Get('live')
  @ApiOperation({ summary: 'Liveness check' })
  @ApiResponse({ status: 200, description: 'Service is alive' })
  liveness() {
    return {
      status: 'alive',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    };
  }
}
