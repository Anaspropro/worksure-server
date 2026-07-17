import { ApiProperty } from '@nestjs/swagger';

export class MarkNotificationsDto {
  @ApiProperty({ type: [String] })
  notificationIds: string[];
}
