import {
  IsOptional,
  IsString,
  Length,
  Matches,
  MaxLength,
} from 'class-validator';

export class UpdateUserProfileDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  phone?: string;

  @IsOptional()
  @IsString()
  @Length(3, 10)
  payoutBankCode?: string;

  @IsOptional()
  @IsString()
  @Matches(/^\d{10}$/)
  payoutAccountNumber?: string;

  @IsOptional()
  @IsString()
  @MaxLength(150)
  payoutAccountName?: string;
}

export class UserProfileResponseDto {
  id: string;
  name: string;
  email: string;
  role: string;
  status: string;
  phone?: string | null;
  artisanVerified: boolean;
  paystackRecipientCode?: string | null;
  payoutBankCode?: string | null;
  payoutAccountNumber?: string | null;
  payoutAccountName?: string | null;
  createdAt: string;
  lastLoginAt: string | null;
  artisanProfile?: {
    id: string;
    bio: string | null;
    skills: any;
    experience: string | null;
    portfolio: any;
    verified: boolean;
    rating: number | null;
    reviewCount: number;
  } | null;
}
