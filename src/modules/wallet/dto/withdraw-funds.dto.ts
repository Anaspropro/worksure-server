import { IsNumber, IsString, IsOptional, Min } from 'class-validator';

export class WithdrawFundsDto {
  @IsNumber()
  @Min(1)
  amount: number;

  @IsString()
  @IsOptional()
  reference?: string;

  @IsString()
  @IsOptional()
  bankCode?: string;

  @IsString()
  @IsOptional()
  accountNumber?: string;

  @IsOptional()
  metadata?: any;
}
