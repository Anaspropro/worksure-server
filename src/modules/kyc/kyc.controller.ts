import {
  Controller,
  Post,
  Get,
  Body,
  UseGuards,
  Request,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
} from '@nestjs/common';
import { KycService } from './kyc.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiConsumes } from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { KycDocumentType } from '../../generated/prisma';

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
      throw new BadRequestException('bvn, bankCode, and accountNumber are required');
    }
    return this.kycService.verifyIdentityWithPaystack(req.user.id, bvn, bankCode, accountNumber);
  }

  @Post('upload')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: {
        fileSize: 10 * 1024 * 1024,
      },
    }),
  )
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Upload a KYC document' })
  async uploadDocument(
    @Request() req,
    @UploadedFile() file: Express.Multer.File,
    @Body('documentType') documentType: KycDocumentType,
  ) {
    if (!documentType) {
      throw new BadRequestException('documentType is required');
    }
    return this.kycService.uploadKycDocument(req.user.id, file, documentType);
  }

  @Get('status')
  @ApiOperation({ summary: 'Get current KYC status' })
  async getStatus(@Request() req) {
    return this.kycService.getKycStatus(req.user.id);
  }
}
