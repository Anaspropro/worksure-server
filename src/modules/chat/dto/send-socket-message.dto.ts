import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';
import {
  MessageType as MessageTypeEnum,
  type MessageType,
} from '../../../generated/prisma';

export class SendSocketMessageDto {
  @IsUUID()
  conversationId: string;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  content?: string;

  @IsOptional()
  @IsEnum(MessageTypeEnum)
  type?: MessageType;

  @ValidateIf((value) => typeof value.fileUrl === 'string')
  @IsString()
  fileUrl?: string;

  @IsOptional()
  @IsString()
  fileType?: string;

  @IsOptional()
  @IsString()
  fileName?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  fileSize?: number;
}
