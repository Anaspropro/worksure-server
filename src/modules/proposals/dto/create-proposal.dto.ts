import { IsString, IsOptional, IsNumber, IsEnum, IsArray } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ProposalStatus } from '../../../generated/prisma';

export class CreateProposalDto {
  @ApiProperty({ description: 'Job ID' })
  @IsString()
  jobId: string;

  @ApiProperty({ description: 'Proposal message' })
  @IsString()
  message: string;

  @ApiProperty({ description: 'Proposed amount' })
  @IsNumber()
  amount: number;
}

export class UpdateProposalDto {
  @ApiPropertyOptional({ description: 'Proposal message' })
  @IsOptional()
  @IsString()
  message?: string;

  @ApiPropertyOptional({ description: 'Proposed amount' })
  @IsOptional()
  @IsNumber()
  amount?: number;
}

export class ProposalResponseDto {
  @ApiProperty({ description: 'Proposal ID' })
  id: string;

  @ApiProperty({ description: 'Job ID' })
  jobId: string;

  @ApiProperty({ description: 'Proposal message' })
  message: string;

  @ApiProperty({ description: 'Proposed amount' })
  amount: number;

  @ApiProperty({ description: 'Proposal status' })
  status: ProposalStatus;

  @ApiProperty({ description: 'Creation date' })
  createdAt: string;

  @ApiProperty({ description: 'Last update date' })
  updatedAt: string;

  @ApiProperty({ description: 'Job information' })
  job: {
    id: string;
    title: string;
    description?: string;
    budget: number;
    status: string;
  };

  @ApiProperty({ description: 'Client information' })
  client: {
    id: string;
    name: string;
    email: string;
  };

  @ApiProperty({ description: 'Artisan information' })
  artisan: {
    id: string;
    name: string;
    email: string;
  };
}

export class ProposalListQueryDto {
  @ApiPropertyOptional({ description: 'Filter by status' })
  @IsOptional()
  @IsEnum(ProposalStatus)
  status?: ProposalStatus;

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

  @ApiPropertyOptional({ description: 'Search in message and notes' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ description: 'Page number (default: 1)' })
  @IsOptional()
  @IsNumber()
  page?: number = 1;

  @ApiPropertyOptional({ description: 'Items per page (default: 10, max: 100)' })
  @IsOptional()
  @IsNumber()
  limit?: number = 10;
}

export class ProposalActionDto {
  @ApiProperty({ description: 'Action notes (for rejection)' })
  @IsOptional()
  @IsString()
  notes?: string;
}
