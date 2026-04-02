import {
  IsString,
  IsOptional,
  IsNumber,
  IsEnum,
  IsDateString,
  Min,
  Max,
  IsArray,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { DisputeStatus, DisputeDecision } from '../../../generated/prisma';

export class CreateDisputeDto {
  @ApiProperty({ description: 'Contract ID (if contract-related)' })
  @IsOptional()
  @IsString()
  contractId?: string;

  @ApiProperty({ description: 'Job ID (if job-related)' })
  @IsOptional()
  @IsString()
  jobId?: string;

  @ApiProperty({ description: 'Dispute amount' })
  @IsNumber()
  @Min(1)
  amount: number;

  @ApiProperty({ description: 'Dispute description' })
  @IsString()
  description: string;

  @ApiPropertyOptional({ description: 'Evidence images URLs' })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  evidenceImages?: string[];

  @ApiPropertyOptional({ description: 'Evidence videos URLs' })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  evidenceVideos?: string[];

  @ApiPropertyOptional({ description: 'Evidence messages' })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  evidenceMessages?: string[];
}

export class UpdateDisputeDto {
  @ApiPropertyOptional({ description: 'Dispute status' })
  @IsOptional()
  @IsEnum(DisputeStatus)
  status?: DisputeStatus;

  @ApiPropertyOptional({ description: 'Resolution decision' })
  @IsOptional()
  @IsEnum(DisputeDecision)
  resolutionDecision?: DisputeDecision;

  @ApiPropertyOptional({ description: 'Resolution notes' })
  @IsOptional()
  @IsString()
  resolutionNotes?: string;

  @ApiPropertyOptional({ description: 'Resolver ID' })
  @IsOptional()
  @IsString()
  resolvedBy?: string;
}

export class DisputeResponseDto {
  @ApiProperty({ description: 'Dispute ID' })
  id: string;

  @ApiPropertyOptional({ description: 'Contract ID' })
  contractId?: string;

  @ApiPropertyOptional({ description: 'Job ID' })
  jobId?: string;

  @ApiProperty({ description: 'Client ID' })
  clientId: string;

  @ApiProperty({ description: 'Artisan ID' })
  artisanId: string;

  @ApiProperty({ description: 'Dispute amount' })
  amount: number;

  @ApiProperty({ description: 'Dispute status' })
  status: DisputeStatus;

  @ApiProperty({ description: 'Dispute description' })
  description: string;

  @ApiPropertyOptional({ description: 'Evidence images' })
  evidenceImages?: string[];

  @ApiPropertyOptional({ description: 'Evidence videos' })
  evidenceVideos?: string[];

  @ApiPropertyOptional({ description: 'Evidence messages' })
  evidenceMessages?: string[];

  @ApiPropertyOptional({ description: 'Resolution decision' })
  resolutionDecision?: DisputeDecision;

  @ApiPropertyOptional({ description: 'Resolution notes' })
  resolutionNotes?: string;

  @ApiPropertyOptional({ description: 'Resolver ID' })
  resolvedBy?: string;

  @ApiProperty({ description: 'Creation date' })
  createdAt: string;

  @ApiPropertyOptional({ description: 'Resolution date' })
  resolvedAt?: string;
}

export class DisputeListQueryDto {
  @ApiPropertyOptional({ description: 'Filter by status' })
  @IsOptional()
  @IsEnum(DisputeStatus)
  status?: DisputeStatus;

  @ApiPropertyOptional({ description: 'Filter by contract ID' })
  @IsOptional()
  @IsString()
  contractId?: string;

  @ApiPropertyOptional({ description: 'Filter by job ID' })
  @IsOptional()
  @IsString()
  jobId?: string;

  @ApiPropertyOptional({ description: 'Filter by client ID' })
  @IsOptional()
  @IsString()
  clientId?: string;

  @ApiPropertyOptional({ description: 'Filter by artisan ID' })
  @IsOptional()
  @IsString()
  artisanId?: string;

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

  @ApiPropertyOptional({
    description: 'Items per page (default: 10, max: 100)',
  })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(100)
  limit?: number = 10;
}
