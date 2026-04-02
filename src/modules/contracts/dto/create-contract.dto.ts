import { IsString, IsUUID, IsOptional } from 'class-validator';

export class CreateContractDto {
  @IsUUID()
  proposalId: string;

  @IsString()
  @IsOptional()
  notes?: string;
}
