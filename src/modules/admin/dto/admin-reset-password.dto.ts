import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, Max, Min } from 'class-validator';

export class AdminResetPasswordDto {
  @ApiPropertyOptional({
    example: 45,
    description: 'Reset token lifetime in minutes.',
  })
  @IsOptional()
  @IsInt()
  @Min(5)
  @Max(120)
  expiresInMinutes?: number;
}
