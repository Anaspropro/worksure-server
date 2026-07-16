import { Controller, Get, Post, Body, Headers, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { MarketplaceVerificationService } from './marketplace.service';
import { FinancialVerificationService } from './financial.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { VerificationStatusResponseDto, FinancialVerificationInitiateResponseDto } from './dto/verification.dto';

@ApiTags('verification')
@Controller('verification')
export class VerificationController {
  constructor(
    private readonly marketplaceService: MarketplaceVerificationService,
    private readonly financialService: FinancialVerificationService
  ) {}

  @Get('status')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get current verification status (Marketplace & Financial)' })
  @ApiResponse({ status: 200, type: VerificationStatusResponseDto })
  async getStatus(@CurrentUser() user: any) {
    return this.marketplaceService.getStatus(user.id);
  }

  @Post('marketplace/submit')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Submit for marketplace review' })
  async submitMarketplace(@CurrentUser() user: any) {
    return this.marketplaceService.submitProfile(user.id);
  }

  @Post('financial/initiate')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Initiate financial verification with provider' })
  @ApiResponse({ status: 200, type: FinancialVerificationInitiateResponseDto })
  async initiateFinancial(@CurrentUser() user: any) {
    return this.financialService.initiate(user.id, user.email);
  }
}

@ApiTags('webhooks')
@Controller('webhooks/verification')
export class VerificationWebhookController {
  constructor(private readonly financialService: FinancialVerificationService) {}

  @Post('paystack')
  @ApiOperation({ summary: 'Paystack identity verification webhook' })
  async handlePaystackWebhook(@Headers('x-paystack-signature') signature: string, @Body() payload: any) {
    // Ideally secret is fetched from ConfigService
    const secret = process.env.PAYSTACK_SECRET_KEY || 'secret';
    return this.financialService.handleWebhook(payload, signature, secret);
  }
}
