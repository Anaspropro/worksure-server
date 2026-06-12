import { IsNumber, IsString, IsOptional, Min } from 'class-validator';

export class AddFundsDto {
  @IsNumber()
  @Min(1)
  amount: number;

  @IsString()
  @IsOptional()
  reference?: string;

  @IsOptional()
  metadata?: any;

  @IsString()
  @IsOptional()
  callbackUrl?: string;
}
