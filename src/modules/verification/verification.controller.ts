import {
  Controller,
  Get,
  Post,
  Body,
  Headers,
  UseGuards,
  InternalServerErrorException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { MarketplaceVerificationService } from './marketplace.service';
import { FinancialVerificationService } from './financial.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AppConfigService } from '../../config/app-config.service';
import {
  VerificationStatusResponseDto,
  FinancialVerificationInitiateResponseDto,
  ResolveBankAccountDto,
} from './dto/verification.dto';

@ApiTags('verification')
@Controller('verification')
export class VerificationController {
  constructor(
    private readonly marketplaceService: MarketplaceVerificationService,
    private readonly financialService: FinancialVerificationService,
  ) {}

  @Get('status')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('bearer')
  @ApiOperation({
    summary: 'Get current verification status (Marketplace & Financial)',
  })
  @ApiResponse({ status: 200, type: VerificationStatusResponseDto })
  async getStatus(@CurrentUser() user: any) {
    return this.marketplaceService.getStatus(user.id);
  }

  @Get('banks')
  @ApiOperation({ summary: 'List supported Nigerian banks for payout resolution' })
  async getBanks() {
    return this.financialService.getBanks();
  }

  @Post('marketplace/submit')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('bearer')
  @ApiOperation({ summary: 'Submit for marketplace review' })
  async submitMarketplace(@CurrentUser() user: any) {
    return this.marketplaceService.submitProfile(user.id);
  }

  @Post('financial/bank-account')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('bearer')
  @ApiOperation({ summary: 'Resolve and verify bank account via Paystack' })
  async resolveBankAccount(
    @CurrentUser() user: any,
    @Body() dto: ResolveBankAccountDto,
  ) {
    return this.financialService.resolveBankAccount(
      user.id,
      dto.accountNumber,
      dto.bankCode,
    );
  }

  @Post('financial/initiate')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('bearer')
  @ApiOperation({ summary: 'Initiate financial verification with provider' })
  @ApiResponse({ status: 200, type: FinancialVerificationInitiateResponseDto })
  async initiateFinancial(
    @CurrentUser() user: any,
    @Body() body?: { accountNumber?: string; bankCode?: string },
  ) {
    return this.financialService.initiate(user.id, user.email, body);
  }
}

@ApiTags('webhooks')
@Controller('webhooks/verification')
export class VerificationWebhookController {
  constructor(
    private readonly financialService: FinancialVerificationService,
    private readonly appConfig: AppConfigService,
  ) {}

  @Post('paystack')
  @ApiOperation({ summary: 'Paystack identity verification webhook' })
  async handlePaystackWebhook(
    @Headers('x-paystack-signature') signature: string,
    @Body() payload: any,
  ) {
    const secret = this.appConfig.paystackWebhookSecret;
    if (!secret) {
      throw new InternalServerErrorException(
        'Paystack webhook secret is not configured',
      );
    }
    return this.financialService.handleWebhook(payload, signature, secret);
  }
}
