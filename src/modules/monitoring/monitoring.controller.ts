import { Controller, Get, Delete, Query, UseGuards } from '@nestjs/common';
import { MonitoringService } from './monitoring.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../../common/constants/roles.constants';

@Controller('admin/monitoring')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
export class MonitoringController {
  constructor(private readonly monitoringService: MonitoringService) {}

  @Get('health')
  async getHealth() {
    return this.monitoringService.getHealth();
  }

  @Get('logs')
  async getSystemLogs(
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '20',
    @Query('level') level?: string,
    @Query('context') context?: string,
  ) {
    const skip = (Number(page) - 1) * Number(limit);
    const take = Number(limit);

    const where: any = {};
    if (level) where.level = level;
    if (context) where.context = context;

    const [data, total] = await Promise.all([
      this.monitoringService.getSystemLogs({
        skip,
        take,
        where,
        orderBy: { createdAt: 'desc' },
      }),
      this.monitoringService.countSystemLogs(where),
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

  @Delete('logs')
  async clearSystemLogs() {
    await this.monitoringService.clearSystemLogs();
    return { success: true, message: 'System logs cleared' };
  }
}
