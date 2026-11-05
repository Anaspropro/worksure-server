import { ApiProperty } from '@nestjs/swagger';
import {
  MarketplaceVerificationStatus,
  FinancialVerificationStatus,
} from '../../../generated/prisma';

export class MarketplaceVerificationSubmitDto {
  @ApiProperty({ description: 'Portfolio URL if applicable', required: false })
  portfolioUrl?: string;

  @ApiProperty({
    description: 'Additional onboarding information',
    required: false,
  })
  additionalInfo?: string;
}

export class VerificationStatusResponseDto {
  @ApiProperty({ enum: MarketplaceVerificationStatus })
  marketplaceStatus: MarketplaceVerificationStatus;

  @ApiProperty()
  marketplaceApprovedAt?: Date;

  @ApiProperty()
  marketplaceRejectedReason?: string;

  @ApiProperty({ enum: FinancialVerificationStatus })
  financialStatus: FinancialVerificationStatus;

  @ApiProperty()
  financialVerifiedAt?: Date;

  @ApiProperty()
  financialFailureReason?: string;

  @ApiProperty({ description: 'Derived payout eligibility' })
  isPayoutEligible: boolean;
}

export class FinancialVerificationInitiateResponseDto {
  @ApiProperty({ required: false, nullable: true })
  url?: string | null;

  @ApiProperty({ required: false })
  reference?: string;

  @ApiProperty({ required: false })
  verified?: boolean;

  @ApiProperty({ required: false })
  accountName?: string;
}

export class ResolveBankAccountDto {
  @ApiProperty({ description: '10-digit Nigerian bank account number', example: '0123456789' })
  accountNumber: string;

  @ApiProperty({ description: '3-digit or 6-digit bank code', example: '058' })
  bankCode: string;
}
