import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { ResolveDisputeDecision } from '../admin.service';

export class ResolveDisputeDto {
  @ApiProperty({
    enum: ['CLIENT_WINS', 'ARTISAN_WINS', 'SPLIT_DECISION', 'CANCELLED'],
    example: 'CLIENT_WINS',
  })
  @IsEnum(['CLIENT_WINS', 'ARTISAN_WINS', 'SPLIT_DECISION', 'CANCELLED'])
  decision!: ResolveDisputeDecision;

  @ApiPropertyOptional({
    example: 'Evidence supports a full refund.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}
