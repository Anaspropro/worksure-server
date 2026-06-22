import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../../common/constants/roles.constants';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import {
  CreateNotificationDto,
  MarkNotificationsDto,
  NotificationListQueryDto,
  NotificationResponseDto,
  NotificationStatsDto,
  UpdateNotificationDto,
} from './dto/notification.dto';
import { NotificationsService } from './notifications.service';
import { $Enums } from '../../generated/prisma';
import { Query } from '@nestjs/common';

@ApiTags('notifications')
@Controller('notifications')
@UseGuards(JwtAuthGuard, RolesGuard)
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @ApiBearerAuth('bearer')
  @ApiOperation({ summary: 'Create a new notification (Admin only)' })
  @ApiOkResponse({ description: 'Notification created successfully.' })
  @ApiForbiddenResponse({ description: 'Admin access required.' })
  @ApiBadRequestResponse({ description: 'Invalid notification data.' })
  @Roles(UserRole.ADMIN)
  @Post()
  async createNotification(@Body() dto: CreateNotificationDto) {
    return this.notificationsService.createNotification(dto);
  }

  @ApiBearerAuth('bearer')
  @ApiOperation({ summary: 'List notifications with filtering' })
  @ApiOkResponse({ description: 'Notifications retrieved successfully.' })
  @Get()
  async listNotifications(
    @CurrentUser() user: { id: string; role: $Enums.UserRole },
    @Query() query: NotificationListQueryDto,
  ) {
    return this.notificationsService.listNotifications(
      {
        id: user.id,
        role: user.role,
      },
      query,
    );
  }

  @ApiBearerAuth('bearer')
  @ApiOperation({ summary: 'Get current user notifications' })
  @ApiOkResponse({ description: 'User notifications retrieved successfully.' })
  @Get('me')
  async getMyNotifications(
    @CurrentUser() user: { id: string; role: $Enums.UserRole },
  ) {
    const result = await this.notificationsService.listNotifications(
      {
        id: user.id,
        role: user.role,
      },
      { page: 1, limit: 100 },
    );

    return result.data;
  }

  @ApiBearerAuth('bearer')
  @ApiOperation({ summary: 'Get notification by ID' })
  @ApiOkResponse({ description: 'Notification retrieved successfully.' })
  @Get(':id')
  async getNotification(
    @CurrentUser() user: { id: string; role: $Enums.UserRole },
    @Param('id') id: string,
  ): Promise<NotificationResponseDto> {
    return this.notificationsService.getNotificationById(id, {
      id: user.id,
      role: user.role,
    });
  }

  @ApiBearerAuth('bearer')
  @ApiOperation({ summary: 'Update notification' })
  @ApiOkResponse({ description: 'Notification updated successfully.' })
  @Patch(':id')
  async updateNotification(
    @CurrentUser() user: { id: string; role: $Enums.UserRole },
    @Param('id') id: string,
    @Body() dto: UpdateNotificationDto,
  ): Promise<NotificationResponseDto> {
    return this.notificationsService.updateNotification(
      id,
      {
        id: user.id,
        role: user.role,
      },
      dto,
    );
  }

  @ApiBearerAuth('bearer')
  @ApiOperation({ summary: 'Mark multiple notifications as read/archived' })
  @ApiOkResponse({ description: 'Notifications updated successfully.' })
  @Patch('mark')
  async markNotifications(
    @CurrentUser() user: { id: string; role: $Enums.UserRole },
    @Body() dto: MarkNotificationsDto,
  ) {
    return this.notificationsService.markNotifications(
      {
        id: user.id,
        role: user.role,
      },
      dto,
    );
  }

  @ApiBearerAuth('bearer')
  @ApiOperation({ summary: 'Mark all notifications as read' })
  @ApiOkResponse({ description: 'All notifications marked as read.' })
  @Patch('read-all')
  async markAllAsRead(
    @CurrentUser() user: { id: string; role: $Enums.UserRole },
  ) {
    return this.notificationsService.markAllAsRead(user.id);
  }

  @ApiBearerAuth('bearer')
  @ApiOperation({ summary: 'Get notification statistics' })
  @ApiOkResponse({
    description: 'Notification statistics retrieved successfully.',
  })
  @Get('stats/me')
  async getNotificationStats(
    @CurrentUser() user: { id: string; role: $Enums.UserRole },
  ): Promise<NotificationStatsDto> {
    return this.notificationsService.getNotificationStats(user.id);
  }

  @ApiBearerAuth('bearer')
  @ApiOperation({ summary: 'Delete notification' })
  @ApiOkResponse({ description: 'Notification deleted successfully.' })
  @Patch(':id/delete')
  async deleteNotification(
    @CurrentUser() user: { id: string; role: $Enums.UserRole },
    @Param('id') id: string,
  ) {
    return this.notificationsService.deleteNotification(id, {
      id: user.id,
      role: user.role,
    });
  }
}
