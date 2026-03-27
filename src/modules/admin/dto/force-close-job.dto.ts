import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

export class ForceCloseJobDto {
  @ApiPropertyOptional({
    example: 'Fraudulent activity detected during review.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}
