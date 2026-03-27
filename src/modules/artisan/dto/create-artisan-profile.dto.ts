import { IsArray, IsOptional, IsString, MaxLength, IsJSON } from 'class-validator';

export class CreateArtisanProfileDto {
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  bio?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  skills?: string[];

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  experience?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  portfolio?: string[];
}

export class UpdateArtisanProfileDto {
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  bio?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  skills?: string[];

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  experience?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  portfolio?: string[];
}

export class ArtisanProfileResponseDto {
  id: string;
  userId: string;
  bio: string | null;
  skills: any;
  experience: string | null;
  portfolio: any;
  verified: boolean;
  rating: number | null;
  reviewCount: number;
  createdAt: string;
  updatedAt: string;
  user: {
    id: string;
    name: string;
    email: string;
  };
}
