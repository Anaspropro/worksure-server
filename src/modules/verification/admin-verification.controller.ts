import { Controller, Get, Post, Param, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { MarketplaceVerificationService } from './marketplace.service';
import { FinancialVerificationService } from './financial.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@ApiTags('admin-verification')
@Controller('admin/verification')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class AdminVerificationController {
  constructor(
    private readonly marketplaceService: MarketplaceVerificationService,
    private readonly financialService: FinancialVerificationService,
  ) {}

  @Get('marketplace/pending')
  @ApiOperation({ summary: 'Get pending marketplace verifications' })
  async getPending() {
    return this.marketplaceService.getPending();
  }

  @Post('marketplace/:userId/approve')
  @ApiOperation({ summary: 'Approve artisan marketplace verification' })
  async approveMarketplace(
    @Param('userId') userId: string,
    @CurrentUser() admin: any,
  ) {
    return this.marketplaceService.approve(userId, admin.id);
  }

  @Post('marketplace/:userId/reject')
  @ApiOperation({ summary: 'Reject artisan marketplace verification' })
  async rejectMarketplace(
    @Param('userId') userId: string,
    @Body('reason') reason: string,
    @CurrentUser() admin: any,
  ) {
    return this.marketplaceService.reject(userId, reason, admin.id);
  }
}
