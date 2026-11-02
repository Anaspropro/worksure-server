import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
  Query,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { NotificationsService } from './notifications.service';
import { $Enums, NotificationChannel } from '../../generated/prisma';
import { MarkNotificationsDto } from './dto/notification.dto';

@ApiTags('notifications')
@Controller('notifications')
@UseGuards(JwtAuthGuard)
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @ApiBearerAuth('bearer')
  @ApiOperation({ summary: 'List notifications with filtering' })
  @ApiOkResponse({ description: 'Notifications retrieved successfully.' })
  @Get()
  async listNotifications(
    @CurrentUser() user: { id: string; role: $Enums.UserRole },
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.notificationsService.listNotifications(
      user.id,
      page ? parseInt(page) : 1,
      limit ? parseInt(limit) : 20,
    );
  }

  @ApiBearerAuth('bearer')
  @ApiOperation({ summary: 'Get unread notification count' })
  @ApiOkResponse({ description: 'Unread count retrieved successfully.' })
  @Get('unread-count')
  async getUnreadCount(
    @CurrentUser() user: { id: string; role: $Enums.UserRole },
  ) {
    const count = await this.notificationsService.getUnreadCount(user.id);
    return { unreadCount: count };
  }

  @ApiBearerAuth('bearer')
  @ApiOperation({ summary: 'Mark multiple notifications as read' })
  @ApiOkResponse({ description: 'Notifications marked as read.' })
  @Patch('mark')
  async markNotifications(
    @CurrentUser() user: { id: string; role: $Enums.UserRole },
    @Body() dto: MarkNotificationsDto,
  ) {
    return this.notificationsService.markAsRead(user.id, dto.notificationIds);
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
  @ApiOperation({ summary: 'Get user notification preferences' })
  @ApiOkResponse({ description: 'Preferences retrieved successfully.' })
  @Get('preferences')
  async getPreferences(
    @CurrentUser() user: { id: string; role: $Enums.UserRole },
  ) {
    return this.notificationsService.getPreferences(user.id);
  }

  @ApiBearerAuth('bearer')
  @ApiOperation({ summary: 'Update notification preference' })
  @ApiOkResponse({ description: 'Preference updated successfully.' })
  @Patch('preferences')
  async updatePreference(
    @CurrentUser() user: { id: string; role: $Enums.UserRole },
    @Body()
    dto: { channel: NotificationChannel; category: string; enabled: boolean },
  ) {
    return this.notificationsService.updatePreference(
      user.id,
      dto.channel,
      dto.category,
      dto.enabled,
    );
  }
}
