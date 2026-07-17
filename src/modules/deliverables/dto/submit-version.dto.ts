import { IsArray, IsEnum, IsOptional, IsString, IsUrl, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { AttachmentType } from '../../../generated/prisma';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

class AttachmentDto {
  @ApiProperty({ enum: AttachmentType })
  @IsEnum(AttachmentType)
  type: AttachmentType;

  @ApiProperty()
  @IsUrl({}, { message: 'Must be a valid URL' })
  url: string;

  @ApiProperty()
  @IsString()
  name: string;

  @ApiPropertyOptional()
  @IsOptional()
  sizeBytes?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  mimeType?: string;
}

export class SubmitDeliverableVersionDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  artisanNotes?: string;

  @ApiProperty({ type: [AttachmentDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AttachmentDto)
  attachments: AttachmentDto[];
}
