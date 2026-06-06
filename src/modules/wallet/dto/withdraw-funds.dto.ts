import { IsInt, IsString, IsOptional, Min } from 'class-validator';

export class WithdrawFundsDto {
  @IsInt()
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
