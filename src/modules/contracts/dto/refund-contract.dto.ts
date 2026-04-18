import { IsUUID, IsString, IsOptional } from 'class-validator';

export class RefundContractDto {
  @IsUUID()
  contractId: string;

  @IsString()
  @IsOptional()
  reason?: string;
}
