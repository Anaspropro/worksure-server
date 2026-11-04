import {
  Controller,
  Post,
  Get,
  Body,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';
import { KycService } from './kyc.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { KycDocumentType } from '../../generated/prisma';
import { UploadKycDocumentDto } from './dto/upload-kyc.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../auth/auth.service';

@ApiTags('kyc')
@ApiBearerAuth('bearer')
@Controller('kyc')
@UseGuards(JwtAuthGuard)
export class KycController {
  constructor(private readonly kycService: KycService) {}

  @Post('verify-identity')
  @ApiOperation({ summary: 'Verify user identity via Paystack BVN match' })
  async verifyIdentity(
    @CurrentUser() user: AuthenticatedUser,
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
      user.id,
      bvn,
      bankCode,
      accountNumber,
    );
  }

  @Post('upload')
  @ApiOperation({ summary: 'Upload a KYC document via direct Cloudinary URL' })
  async uploadDocument(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UploadKycDocumentDto,
  ) {
    return this.kycService.uploadKycDocument(
      user.id,
      dto.documentUrl,
      dto.documentType,
    );
  }

  @Get('status')
  @ApiOperation({ summary: 'Get current KYC status' })
  async getStatus(@CurrentUser() user: AuthenticatedUser) {
    return this.kycService.getKycStatus(user.id);
  }
}
