import { IsString, IsOptional, IsEnum, IsDateString, Min, Max, IsNumber } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export enum NotificationType {
  PROPOSAL_RECEIVED = 'proposal_received',
  PROPOSAL_ACCEPTED = 'proposal_accepted',
  PROPOSAL_REJECTED = 'proposal_rejected',
  PROPOSAL_WITHDRAWN = 'proposal_withdrawn',
  CONTRACT_CREATED = 'contract_created',
  CONTRACT_FUNDED = 'contract_funded',
  CONTRACT_STARTED = 'contract_started',
  CONTRACT_COMPLETED = 'contract_completed',
  PAYMENT_VERIFIED = 'payment_verified',
  DISPUTE_CREATED = 'dispute_created',
  DISPUTE_RESOLVED = 'dispute_resolved',
  REVIEW_RECEIVED = 'review_received',
  MESSAGE_RECEIVED = 'message_received',
  SYSTEM_UPDATE = 'system_update',
}

export enum NotificationPriority {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  URGENT = 'urgent',
}

export class CreateNotificationDto {
  @ApiProperty({ description: 'User ID' })
  @IsString()
  userId: string;

  @ApiProperty({ description: 'Notification type' })
  @IsEnum(NotificationType)
  type: NotificationType;

  @ApiProperty({ description: 'Notification title' })
  @IsString()
  title: string;

  @ApiProperty({ description: 'Notification message' })
  @IsString()
  message: string;

  @ApiPropertyOptional({ description: 'Related entity ID' })
  @IsOptional()
  @IsString()
  entityId?: string;

  @ApiPropertyOptional({ description: 'Related entity type' })
  @IsOptional()
  @IsString()
  entityType?: string;

  @ApiPropertyOptional({ description: 'Action URL' })
  @IsOptional()
  @IsString()
  actionUrl?: string;

  @ApiPropertyOptional({ description: 'Notification priority' })
  @IsOptional()
  @IsEnum(NotificationPriority)
  priority?: NotificationPriority;

  @ApiPropertyOptional({ description: 'Additional metadata' })
  @IsOptional()
  metadata?: Record<string, any>;
}

export class UpdateNotificationDto {
  @ApiPropertyOptional({ description: 'Mark as read' })
  @IsOptional()
  isRead?: boolean;

  @ApiPropertyOptional({ description: 'Mark as archived' })
  @IsOptional()
  isArchived?: boolean;

  @ApiPropertyOptional({ description: 'Action URL' })
  @IsOptional()
  @IsString()
  actionUrl?: string;

  @ApiPropertyOptional({ description: 'Additional metadata' })
  @IsOptional()
  metadata?: Record<string, any>;
}

export class NotificationResponseDto {
  @ApiProperty({ description: 'Notification ID' })
  id: string;

  @ApiProperty({ description: 'User ID' })
  userId: string;

  @ApiProperty({ description: 'Notification type' })
  type: NotificationType;

  @ApiProperty({ description: 'Notification title' })
  title: string;

  @ApiProperty({ description: 'Notification message' })
  message: string;

  @ApiPropertyOptional({ description: 'Related entity ID' })
  entityId?: string;

  @ApiPropertyOptional({ description: 'Related entity type' })
  entityType?: string;

  @ApiPropertyOptional({ description: 'Action URL' })
  actionUrl?: string;

  @ApiProperty({ description: 'Notification priority' })
  priority: NotificationPriority;

  @ApiProperty({ description: 'Is read' })
  isRead: boolean;

  @ApiProperty({ description: 'Is archived' })
  isArchived: boolean;

  @ApiPropertyOptional({ description: 'Additional metadata' })
  metadata?: Record<string, any>;

  @ApiProperty({ description: 'Creation date' })
  createdAt: string;

  @ApiPropertyOptional({ description: 'Read date' })
  readAt?: string;

  @ApiPropertyOptional({ description: 'Archived date' })
  archivedAt?: string;
}

export class NotificationListQueryDto {
  @ApiPropertyOptional({ description: 'Filter by type' })
  @IsOptional()
  @IsEnum(NotificationType)
  type?: NotificationType;

  @ApiPropertyOptional({ description: 'Filter by priority' })
  @IsOptional()
  @IsEnum(NotificationPriority)
  priority?: NotificationPriority;

  @ApiPropertyOptional({ description: 'Filter by read status' })
  @IsOptional()
  @IsEnum(['true', 'false'])
  isRead?: string;

  @ApiPropertyOptional({ description: 'Filter by archived status' })
  @IsOptional()
  @IsEnum(['true', 'false'])
  isArchived?: string;

  @ApiPropertyOptional({ description: 'Filter by entity ID' })
  @IsOptional()
  @IsString()
  entityId?: string;

  @ApiPropertyOptional({ description: 'Filter by entity type' })
  @IsOptional()
  @IsString()
  entityType?: string;

  @ApiPropertyOptional({ description: 'Filter by date from' })
  @IsOptional()
  @IsDateString()
  dateFrom?: string;

  @ApiPropertyOptional({ description: 'Filter by date to' })
  @IsOptional()
  @IsDateString()
  dateTo?: string;

  @ApiPropertyOptional({ description: 'Page number (default: 1)' })
  @IsOptional()
  @IsNumber()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ description: 'Items per page (default: 20, max: 100)' })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(100)
  limit?: number = 20;
}

export class NotificationStatsDto {
  @ApiProperty({ description: 'Total notifications' })
  total: number;

  @ApiProperty({ description: 'Unread notifications' })
  unread: number;

  @ApiProperty({ description: 'Archived notifications' })
  archived: number;

  @ApiProperty({ description: 'Notifications by type' })
  byType: Record<NotificationType, number>;

  @ApiProperty({ description: 'Notifications by priority' })
  byPriority: Record<NotificationPriority, number>;
}

export class MarkNotificationsDto {
  @ApiProperty({ description: 'Notification IDs' })
  @IsString({ each: true })
  notificationIds: string[];

  @ApiProperty({ description: 'Mark as read' })
  @IsOptional()
  markAsRead?: boolean;

  @ApiProperty({ description: 'Mark as archived' })
  @IsOptional()
  markAsArchived?: boolean;
}
