import {
  IsString,
  IsOptional,
  IsNumber,
  IsEnum,
  IsDateString,
  Min,
  Max,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class PaymentFundContractDto {
  @ApiProperty({ description: 'Contract ID to fund' })
  @IsString()
  contractId: string;

  @ApiProperty({ description: 'Funding amount' })
  @IsNumber()
  @Min(1)
  amount: number;

  @ApiPropertyOptional({ description: 'Payment method' })
  @IsOptional()
  @IsString()
  paymentMethod?: string;

  @ApiPropertyOptional({ description: 'Payment reference' })
  @IsOptional()
  @IsString()
  paymentReference?: string;
}

export class VerifyPaymentDto {
  @ApiProperty({ description: 'Payment ID to verify' })
  @IsString()
  paymentId: string;

  @ApiProperty({ description: 'Verification code' })
  @IsString()
  verificationCode: string;
}

export class ActivateContractDto {
  @ApiProperty({ description: 'Contract ID to activate' })
  @IsString()
  contractId: string;

  @ApiPropertyOptional({ description: 'Activation notes' })
  @IsOptional()
  @IsString()
  notes?: string;
}

export class CompleteContractDto {
  @ApiProperty({ description: 'Contract ID to complete' })
  @IsString()
  contractId: string;

  @ApiPropertyOptional({ description: 'Completion notes' })
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiPropertyOptional({ description: 'Work evidence URLs' })
  @IsOptional()
  @IsString({ each: true })
  evidence?: string[];
}

export class PaymentConfirmCompletionDto {
  @ApiProperty({ description: 'Contract ID' })
  @IsString()
  contractId: string;

  @ApiProperty({ description: 'Confirmation type (client or artisan)' })
  @IsEnum(['client', 'artisan'])
  role: 'client' | 'artisan';

  @ApiPropertyOptional({ description: 'Confirmation notes' })
  @IsOptional()
  @IsString()
  notes?: string;
}

export class PaymentResponseDto {
  @ApiProperty({ description: 'Payment ID' })
  id: string;

  @ApiProperty({ description: 'Contract ID' })
  contractId: string;

  @ApiProperty({ description: 'User ID who made payment' })
  userId: string;

  @ApiProperty({ description: 'Payment amount' })
  amount: number;

  @ApiProperty({ description: 'Payment status' })
  status: string;

  @ApiPropertyOptional({ description: 'Payment method' })
  paymentMethod?: string;

  @ApiPropertyOptional({ description: 'Payment reference' })
  paymentReference?: string;

  @ApiPropertyOptional({ description: 'Verification code' })
  verificationCode?: string;

  @ApiProperty({ description: 'Is verified' })
  isVerified: boolean;

  @ApiProperty({ description: 'Creation date' })
  createdAt: string;

  @ApiPropertyOptional({ description: 'Verification date' })
  verifiedAt?: string;

  @ApiPropertyOptional({ description: 'Completion date' })
  completedAt?: string;
}

export class PaymentListQueryDto {
  @ApiPropertyOptional({ description: 'Filter by contract ID' })
  @IsOptional()
  @IsString()
  contractId?: string;

  @ApiPropertyOptional({ description: 'Filter by status' })
  @IsOptional()
  @IsString()
  status?: string;

  @ApiPropertyOptional({ description: 'Filter by verification status' })
  @IsOptional()
  @IsEnum(['verified', 'pending', 'failed'])
  verificationStatus?: 'verified' | 'pending' | 'failed';

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
