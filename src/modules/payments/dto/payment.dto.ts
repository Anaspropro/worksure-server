import {
  IsDateString,
  IsEmail,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class PaymentFundContractDto {
  @ApiProperty({ description: 'Contract ID to fund' })
  @IsUUID()
  contractId: string;

  @ApiProperty({ description: 'Payer email for Paystack checkout' })
  @IsEmail()
  email: string;

  @ApiPropertyOptional({ description: 'Callback URL for Paystack redirect' })
  @IsOptional()
  @IsString()
  callbackUrl?: string;
}

export class PaystackInitDto {
  @ApiProperty({ description: 'Contract ID to fund' })
  @IsUUID()
  contractId: string;

  @ApiProperty({ description: 'Payer email for Paystack checkout' })
  @IsEmail()
  email: string;

  @ApiPropertyOptional({ description: 'Callback URL for Paystack redirect' })
  @IsOptional()
  @IsString()
  callbackUrl?: string;
}

export class PaystackVerifyDto {
  @ApiProperty({ description: 'Paystack transaction reference to verify' })
  @IsString()
  reference: string;
}

export class VerifyPaymentDto {
  @ApiProperty({ description: 'Payment ID to verify' })
  @IsUUID()
  paymentId: string;

  @ApiProperty({ description: 'Verification code' })
  @IsString()
  verificationCode: string;
}

export class ActivateContractDto {
  @ApiProperty({ description: 'Contract ID to activate' })
  @IsUUID()
  contractId: string;
}

export class CompleteContractDto {
  @ApiProperty({ description: 'Contract ID' })
  @IsUUID()
  contractId: string;

  @ApiProperty({ description: 'Confirmation type' })
  @IsIn(['client', 'artisan'])
  role: 'client' | 'artisan';

  @ApiPropertyOptional({ description: 'Completion notes' })
  @IsOptional()
  @IsString()
  notes?: string;
}

export class PaymentConfirmCompletionDto extends CompleteContractDto {}

export class PaymentResponseDto {
  @ApiProperty({ description: 'Payment ID' })
  id: string;

  @ApiProperty({ description: 'Contract ID' })
  contractId: string;

  @ApiProperty({ description: 'User ID who made payment' })
  userId: string;

  @ApiProperty({ description: 'Payment amount in naira' })
  amount: number;

  @ApiProperty({ description: 'Payment status' })
  status: string;

  @ApiPropertyOptional({ description: 'Provider reference' })
  paymentReference?: string | null;

  @ApiPropertyOptional({ description: 'Paystack access code' })
  paystackAccessCode?: string | null;

  @ApiPropertyOptional({ description: 'Paystack authorization URL' })
  paystackAuthorizationUrl?: string | null;

  @ApiProperty({ description: 'Is verified' })
  isVerified: boolean;

  @ApiProperty({ description: 'Creation date' })
  createdAt: string;

  @ApiPropertyOptional({ description: 'Verification date' })
  verifiedAt?: string | null;

  @ApiPropertyOptional({ description: 'Completion date' })
  completedAt?: string | null;
}

export class PaymentListQueryDto {
  @ApiPropertyOptional({ description: 'Filter by contract ID' })
  @IsOptional()
  @IsUUID()
  contractId?: string;

  @ApiPropertyOptional({ description: 'Filter by status' })
  @IsOptional()
  @IsString()
  status?: string;

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
