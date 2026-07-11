import { IsString, IsOptional, IsNumber, IsEnum, IsBoolean } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ProposalStatus } from '../../../generated/prisma';

export class ProposalAttachmentDto {
  @ApiProperty({ description: 'File URL' })
  @IsString()
  fileUrl: string;

  @ApiProperty({ description: 'File name' })
  @IsString()
  fileName: string;

  @ApiProperty({ description: 'File type (MIME)' })
  @IsString()
  fileType: string;

  @ApiProperty({ description: 'File size in bytes' })
  @IsNumber()
  fileSize: number;
}

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

  @ApiPropertyOptional({ description: 'Estimated duration' })
  @IsOptional()
  @IsString()
  estimatedDuration?: string;

  @ApiPropertyOptional({ description: 'Attachments', type: [ProposalAttachmentDto] })
  @IsOptional()
  attachments?: ProposalAttachmentDto[];

  @ApiPropertyOptional({ description: 'Save as draft' })
  @IsOptional()
  @IsBoolean()
  isDraft?: boolean;
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

  @ApiPropertyOptional({ description: 'Estimated duration' })
  @IsOptional()
  @IsString()
  estimatedDuration?: string;
}

export class ProposalJobDto {
  @ApiProperty() id: string;
  @ApiProperty() title: string;
  @ApiPropertyOptional() description?: string;
  @ApiProperty() budget: number;
  @ApiProperty() status: string;
}

export class ProposalClientDto {
  @ApiProperty() id: string;
  @ApiProperty() name: string;
  @ApiProperty() email: string;
}

export class ProposalArtisanProfileDto {
  @ApiPropertyOptional() rating?: number;
  @ApiPropertyOptional() verified?: boolean;
}

export class ProposalArtisanDto {
  @ApiProperty() id: string;
  @ApiProperty() name: string;
  @ApiProperty() email: string;
  @ApiPropertyOptional({ type: ProposalArtisanProfileDto }) artisanProfile?: ProposalArtisanProfileDto;
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

  @ApiPropertyOptional({ description: 'Estimated duration' })
  estimatedDuration?: string;

  @ApiProperty({ description: 'Proposal status', enum: ProposalStatus })
  status: ProposalStatus;

  @ApiProperty({ description: 'Creation date' })
  createdAt: string;

  @ApiProperty({ description: 'Last update date' })
  updatedAt: string;


  @ApiProperty({ description: 'Job information', type: ProposalJobDto })
  job: ProposalJobDto;

  @ApiProperty({ description: 'Client information', type: ProposalClientDto })
  client: ProposalClientDto;

  @ApiProperty({ description: 'Artisan information', type: ProposalArtisanDto })
  artisan: ProposalArtisanDto;
  
  @ApiPropertyOptional({ description: 'Attachments', type: [ProposalAttachmentDto] })
  attachments?: ProposalAttachmentDto[];
}

export class ProposalComparisonItemDto {
  @ApiProperty({ description: 'Proposal ID' })
  id: string;

  @ApiProperty({ description: 'Artisan name' })
  artisanName: string;

  @ApiProperty({ description: 'Artisan avatar URL' })
  artisanAvatarUrl?: string;

  @ApiProperty({ description: 'Artisan rating' })
  rating: number;

  @ApiProperty({ description: 'Artisan verification status' })
  verificationStatus: boolean;

  @ApiProperty({ description: 'Proposed bid amount' })
  bid: number;

  @ApiProperty({ description: 'Estimated duration' })
  duration?: string;

  @ApiProperty({ description: 'Cover letter preview (first 100 chars)' })
  coverLetterPreview: string;

  @ApiProperty({ description: 'Number of attachments' })
  attachmentCount: number;

  @ApiProperty({ description: 'Artisan job completion rate' })
  completionRate?: number;

  @ApiProperty({ description: 'Artisan response time metric' })
  responseTime?: number;

  @ApiProperty({ description: 'Is this proposal recommended by the platform' })
  recommended: boolean;
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
  @Type(() => Number)
  @IsNumber()
  page?: number = 1;

  @ApiPropertyOptional({
    description: 'Items per page (default: 10, max: 100)',
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  limit?: number = 10;
}

export class ProposalActionDto {
  @ApiProperty({ description: 'Action notes (for rejection)' })
  @IsOptional()
  @IsString()
  notes?: string;
}
