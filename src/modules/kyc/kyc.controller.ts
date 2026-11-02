import {
  Controller,
  Post,
  Get,
  Body,
  UseGuards,
  Request,
  BadRequestException,
} from '@nestjs/common';
import { KycService } from './kyc.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { KycDocumentType } from '../../generated/prisma';
import { UploadKycDocumentDto } from './dto/upload-kyc.dto';

@ApiTags('kyc')
@ApiBearerAuth('bearer')
@Controller('kyc')
@UseGuards(JwtAuthGuard)
export class KycController {
  constructor(private readonly kycService: KycService) {}

  @Post('verify-identity')
  @ApiOperation({ summary: 'Verify user identity via Paystack BVN match' })
  async verifyIdentity(
    @Request() req,
    @Body('bvn') bvn: string,
    @Body('bankCode') bankCode: string,
    @Body('accountNumber') accountNumber: string,
  ) {
    if (!bvn || !bankCode || !accountNumber) {
      throw new BadRequestException(
        'bvn, bankCode, and accountNumber are required',
      );
    }
    return this.kycService.verifyIdentityWithPaystack(
      req.user.id,
      bvn,
      bankCode,
      accountNumber,
    );
  }

  @Post('upload')
  @ApiOperation({ summary: 'Upload a KYC document via direct Cloudinary URL' })
  async uploadDocument(@Request() req, @Body() dto: UploadKycDocumentDto) {
    return this.kycService.uploadKycDocument(
      req.user.id,
      dto.documentUrl,
      dto.documentType,
    );
  }

  @Get('status')
  @ApiOperation({ summary: 'Get current KYC status' })
  async getStatus(@Request() req) {
    return this.kycService.getKycStatus(req.user.id);
  }
}
