import {
  IsString,
  IsOptional,
  IsNumber,
  IsEnum,
  IsDateString,
  Min,
  Max,
  ArrayNotEmpty,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateReviewDto {
  @ApiProperty({ description: 'Contract ID' })
  @IsString()
  contractId: string;

  @ApiProperty({ description: 'Rating (1-5)' })
  @IsNumber()
  @Min(1)
  @Max(5)
  rating: number;

  @ApiProperty({ description: 'Review comment' })
  @IsString()
  comment: string;

  @ApiPropertyOptional({ description: 'Review categories' })
  @IsOptional()
  @IsString({ each: true })
  categories?: string[];

  @ApiPropertyOptional({ description: 'Work quality rating (1-5)' })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(5)
  workQuality?: number;

  @ApiPropertyOptional({ description: 'Communication rating (1-5)' })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(5)
  communication?: number;

  @ApiPropertyOptional({ description: 'Timeliness rating (1-5)' })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(5)
  timeliness?: number;

  @ApiPropertyOptional({ description: 'Professionalism rating (1-5)' })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(5)
  professionalism?: number;

  @ApiPropertyOptional({ description: 'Supporting evidence URLs' })
  @IsOptional()
  @ArrayNotEmpty()
  @IsString({ each: true })
  evidence?: string[];
}

export class UpdateReviewDto {
  @ApiPropertyOptional({ description: 'Rating (1-5)' })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(5)
  rating?: number;

  @ApiPropertyOptional({ description: 'Review comment' })
  @IsOptional()
  @IsString()
  comment?: string;

  @ApiPropertyOptional({ description: 'Review categories' })
  @IsOptional()
  @IsString({ each: true })
  categories?: string[];

  @ApiPropertyOptional({ description: 'Work quality rating (1-5)' })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(5)
  workQuality?: number;

  @ApiPropertyOptional({ description: 'Communication rating (1-5)' })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(5)
  communication?: number;

  @ApiPropertyOptional({ description: 'Timeliness rating (1-5)' })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(5)
  timeliness?: number;

  @ApiPropertyOptional({ description: 'Professionalism rating (1-5)' })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(5)
  professionalism?: number;

  @ApiPropertyOptional({ description: 'Supporting evidence URLs' })
  @IsOptional()
  @ArrayNotEmpty()
  @IsString({ each: true })
  evidence?: string[];
}

export class ReviewResponseDto {
  @ApiProperty({ description: 'Review ID' })
  id: string;

  @ApiProperty({ description: 'Contract ID' })
  contractId: string;

  @ApiProperty({ description: 'Client ID' })
  clientId: string;

  @ApiProperty({ description: 'Artisan ID' })
  artisanId: string;

  @ApiProperty({ description: 'Overall rating (1-5)' })
  rating: number;

  @ApiProperty({ description: 'Review comment' })
  comment: string;

  @ApiPropertyOptional({ description: 'Review categories' })
  categories?: string[];

  @ApiPropertyOptional({ description: 'Work quality rating (1-5)' })
  workQuality?: number;

  @ApiPropertyOptional({ description: 'Communication rating (1-5)' })
  communication?: number;

  @ApiPropertyOptional({ description: 'Timeliness rating (1-5)' })
  timeliness?: number;

  @ApiPropertyOptional({ description: 'Professionalism rating (1-5)' })
  professionalism?: number;

  @ApiPropertyOptional({ description: 'Supporting evidence' })
  evidence?: string[];

  @ApiProperty({ description: 'Is public' })
  isPublic: boolean;

  @ApiProperty({ description: 'Creation date' })
  createdAt: string;

  @ApiPropertyOptional({ description: 'Last update date' })
  updatedAt?: string;

  @ApiProperty({ description: 'Contract information' })
  contract?: {
    id: string;
    amount: number;
    status: string;
    jobTitle: string;
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

export class ReviewListQueryDto {
  @ApiPropertyOptional({ description: 'Filter by contract ID' })
  @IsOptional()
  @IsString()
  contractId?: string;

  @ApiPropertyOptional({ description: 'Filter by client ID' })
  @IsOptional()
  @IsString()
  clientId?: string;

  @ApiPropertyOptional({ description: 'Filter by artisan ID' })
  @IsOptional()
  @IsString()
  artisanId?: string;

  @ApiPropertyOptional({ description: 'Filter by minimum rating' })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(5)
  minRating?: number;

  @ApiPropertyOptional({ description: 'Filter by maximum rating' })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(5)
  maxRating?: number;

  @ApiPropertyOptional({ description: 'Filter by categories' })
  @IsOptional()
  @IsString({ each: true })
  categories?: string[];

  @ApiPropertyOptional({ description: 'Filter by date from' })
  @IsOptional()
  @IsDateString()
  dateFrom?: string;

  @ApiPropertyOptional({ description: 'Filter by date to' })
  @IsOptional()
  @IsDateString()
  dateTo?: string;

  @ApiPropertyOptional({ description: 'Filter by public status' })
  @IsOptional()
  @IsEnum(['true', 'false'])
  isPublic?: string;

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

export class ReviewStatsDto {
  @ApiProperty({ description: 'Total number of reviews' })
  totalReviews: number;

  @ApiProperty({ description: 'Average rating' })
  averageRating: number;

  @ApiProperty({ description: 'Rating distribution' })
  ratingDistribution: {
    1: number;
    2: number;
    3: number;
    4: number;
    5: number;
  };

  @ApiProperty({ description: 'Category averages' })
  categoryAverages?: {
    workQuality?: number;
    communication?: number;
    timeliness?: number;
    professionalism?: number;
  };
}
