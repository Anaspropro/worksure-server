import {
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsObject,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { EvidenceType } from '../../../generated/prisma';

export class SubmitEvidenceDto {
  @ApiProperty({ enum: EvidenceType, description: 'Type of the evidence' })
  @IsEnum(EvidenceType)
  type: EvidenceType;

  @ApiPropertyOptional({
    description: 'URL of the evidence if it is a file or image',
  })
  @IsString()
  @IsOptional()
  url?: string;

  @ApiPropertyOptional({ description: 'Additional metadata' })
  @IsObject()
  @IsOptional()
  metadata?: Record<string, any>;
}
