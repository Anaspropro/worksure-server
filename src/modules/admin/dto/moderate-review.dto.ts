import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString } from 'class-validator';

export enum ModerateReviewAction {
  FLAG = 'FLAG',
  LOCK = 'LOCK',
  RESTORE = 'RESTORE',
}

export class ModerateReviewDto {
  @ApiProperty({ enum: ModerateReviewAction, description: 'Moderation action to apply' })
  @IsEnum(ModerateReviewAction)
  action: ModerateReviewAction;

  @ApiProperty({ description: 'Optional reason for the moderation action', required: false })
  @IsOptional()
  @IsString()
  reason?: string;
}
