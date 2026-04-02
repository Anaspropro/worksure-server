import { IsUUID, IsBoolean, IsString, IsOptional } from 'class-validator';

export class ConfirmCompletionDto {
  @IsUUID()
  contractId: string;

  @IsBoolean()
  isClient: boolean;

  @IsString()
  @IsOptional()
  notes?: string;
}
