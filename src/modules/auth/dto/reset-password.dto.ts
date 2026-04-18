import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';

export class ResetPasswordDto {
  @ApiProperty({
    example: '9680f2b7c46a10f7b4d7c8d3e1f6a4cf5d0d09716a2e6f9248d1f317f3f1fa3a',
  })
  @IsString()
  token!: string;

  @ApiProperty({ example: 'NewSecurePass123' })
  @IsString()
  @MinLength(8)
  newPassword!: string;
}
