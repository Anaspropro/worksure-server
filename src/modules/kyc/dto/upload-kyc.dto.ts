import { IsEnum, IsNotEmpty, IsUrl, Matches } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { KycDocumentType } from '../../../generated/prisma';

export class UploadKycDocumentDto {
  @ApiProperty({
    description: 'Document URL originating from Cloudinary secure storage',
    example:
      'https://res.cloudinary.com/worksure/image/upload/v1234567890/id-card.jpg',
  })
  @IsNotEmpty()
  @IsUrl({ protocols: ['https'], require_protocol: true })
  @Matches(/^https:\/\/res\.cloudinary\.com\/[a-zA-Z0-9_-]+\//, {
    message:
      'documentUrl must originate from the approved Cloudinary storage domain',
  })
  documentUrl: string;

  @ApiProperty({
    enum: KycDocumentType,
    description: 'Type of KYC document being uploaded',
    example: KycDocumentType.ID,
  })
  @IsNotEmpty()
  @IsEnum(KycDocumentType)
  documentType: KycDocumentType;
}
