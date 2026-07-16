import { IsOptional, IsString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class RequestRevisionDto {
  @ApiProperty()
  @IsString()
  comment: string;

  @ApiProperty()
  @IsString()
  requiredChanges: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  dueDate?: string;
}
