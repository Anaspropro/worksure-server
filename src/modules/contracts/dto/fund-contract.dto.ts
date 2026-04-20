import { IsEmail, IsOptional, IsString, IsUUID } from 'class-validator';

export class FundContractDto {
  @IsUUID()
  contractId: string;

  @IsEmail()
  email: string;

  @IsString()
  @IsOptional()
  callbackUrl?: string;
}
