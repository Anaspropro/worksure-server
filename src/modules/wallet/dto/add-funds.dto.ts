import { IsInt, IsString, IsOptional, Min } from 'class-validator';

export class AddFundsDto {
  @IsInt()
  @Min(1)
  amount: number;

  @IsString()
  @IsOptional()
  reference?: string;

  @IsOptional()
  metadata?: any;
}
