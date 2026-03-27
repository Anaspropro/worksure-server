import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { ResolveDisputeDecision } from '../admin.service';

export class ResolveDisputeDto {
  @ApiProperty({
    enum: ['REFUND_CLIENT', 'PAY_ARTISAN'],
    example: 'REFUND_CLIENT',
  })
  @IsEnum(['REFUND_CLIENT', 'PAY_ARTISAN'])
  decision!: ResolveDisputeDecision;

  @ApiPropertyOptional({
    example: 'Evidence supports a full refund.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}
