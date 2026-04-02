import { IsUUID, IsInt, IsString, IsOptional, Min } from 'class-validator';

export class FundContractDto {
  @IsUUID()
  contractId: string;

  @IsInt()
  @Min(1)
  amount: number;

  @IsString()
  @IsOptional()
  paymentMethod?: string;

  @IsString()
  @IsOptional()
  paymentReference?: string;
}
