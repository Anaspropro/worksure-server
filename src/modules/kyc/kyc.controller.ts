import {
  Controller,
  Post,
  Get,
  Body,
  UseGuards,
  Request,
} from '@nestjs/common';
import { KycService } from './kyc.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';

@ApiTags('kyc')
@ApiBearerAuth('bearer')
@Controller('kyc')
@UseGuards(JwtAuthGuard)
export class KycController {
  constructor(private readonly kycService: KycService) {}

  @Post('verify-bvn')
  @ApiOperation({ summary: 'Verify user BVN via Paystack' })
  async verifyBvn(@Request() req, @Body('bvn') bvn: string) {
    return this.kycService.verifyBvn(req.user.id, bvn);
  }

  @Get('status')
  @ApiOperation({ summary: 'Get current KYC status' })
  async getStatus(@Request() req) {
    return this.kycService.getKycStatus(req.user.id);
  }
}
