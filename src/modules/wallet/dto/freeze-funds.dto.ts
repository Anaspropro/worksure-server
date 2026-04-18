import { IsInt, IsString, IsOptional, Min } from 'class-validator';

export class FreezeFundsDto {
  @IsInt()
  @Min(1)
  amount: number;

  @IsString()
  reference: string;

  @IsOptional()
  metadata?: any;
}
