import { ApiProperty } from '@nestjs/swagger';
import { MarketplaceVerificationStatus, FinancialVerificationStatus } from '../../../generated/prisma';

export class MarketplaceVerificationSubmitDto {
  @ApiProperty({ description: 'Portfolio URL if applicable', required: false })
  portfolioUrl?: string;

  @ApiProperty({ description: 'Additional onboarding information', required: false })
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
  @ApiProperty()
  url: string;

  @ApiProperty()
  reference: string;
}
