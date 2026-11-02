import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
  HttpStatus,
  HttpCode,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { WalletService } from './wallet.service';
import { AddFundsDto } from './dto/add-funds.dto';
import { WithdrawFundsDto } from './dto/withdraw-funds.dto';
import { FreezeFundsDto } from './dto/freeze-funds.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../auth/auth.service';
import { BadRequestException } from '@nestjs/common';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../../common/constants/roles.constants';

@ApiTags('wallet')
@Controller('wallet')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class WalletController {
  constructor(private readonly walletService: WalletService) {}

  @Get('balance')
  @Roles(UserRole.CLIENT, UserRole.ARTISAN)
  @ApiOperation({ summary: 'Get wallet balance' })
  @ApiResponse({
    status: 200,
    description: 'Wallet balance retrieved successfully',
  })
  async getWalletBalance(@CurrentUser() user: AuthenticatedUser) {
    const balance = await this.walletService.getWalletBalance(user.id);

    return {
      data: balance,
    };
  }

  @Get('transactions')
  @Roles(UserRole.CLIENT, UserRole.ARTISAN)
  @ApiOperation({ summary: 'Get wallet transactions' })
  @ApiResponse({
    status: 200,
    description: 'Wallet transactions retrieved successfully',
  })
  async getWalletTransactions(
    @CurrentUser() user: AuthenticatedUser,
    @Query('limit') limit?: number,
    @Query('offset') offset?: number,
  ) {
    const transactions = await this.walletService.getWalletTransactions(
      user.id,
      limit ? parseInt(limit.toString()) : 50,
      offset ? parseInt(offset.toString()) : 0,
    );

    return {
      data: transactions,
    };
  }

  @Get('summary')
  @Roles(UserRole.CLIENT, UserRole.ARTISAN)
  @ApiOperation({ summary: 'Get wallet summary' })
  @ApiResponse({
    status: 200,
    description: 'Wallet summary retrieved successfully',
  })
  async getWalletSummary(@CurrentUser() user: AuthenticatedUser) {
    const summary = await this.walletService.getWalletSummary(user.id);

    return {
      data: summary,
    };
  }

  @Get('transactions/:transactionId')
  @Roles(UserRole.CLIENT, UserRole.ARTISAN)
  @ApiOperation({ summary: 'Get transaction details' })
  @ApiResponse({
    status: 200,
    description: 'Transaction details retrieved successfully',
  })
  async getTransaction(
    @Param('transactionId') transactionId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const transaction = await this.walletService.getTransaction(
      user.id,
      transactionId,
    );

    return {
      data: transaction,
    };
  }

  @Post('create')
  @Roles(UserRole.CLIENT, UserRole.ARTISAN)
  @ApiOperation({ summary: 'Create a wallet for the user' })
  @ApiResponse({ status: 201, description: 'Wallet created successfully' })
  async createWallet(@CurrentUser() user: AuthenticatedUser) {
    const wallet = await this.walletService.createWallet(user.id);

    return {
      message: wallet.created
        ? 'Wallet created successfully'
        : 'Wallet already exists',
      data: wallet,
    };
  }

  @Post('deposit/init')
  @Roles(UserRole.CLIENT)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Initialize wallet deposit via Paystack' })
  @ApiResponse({ status: 200, description: 'Checkout initialized' })
  async initiateDeposit(
    @Body() addFundsDto: AddFundsDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const result = await this.walletService.initiateWalletDeposit(
      user.id,
      addFundsDto.amount,
      user.email,
      addFundsDto.callbackUrl,
    );

    return result;
  }

  @Post('deposit/verify')
  @Roles(UserRole.CLIENT)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Verify wallet deposit via Paystack reference' })
  @ApiResponse({ status: 200, description: 'Deposit verified successfully' })
  async verifyDeposit(
    @Body('reference') reference: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    if (!reference) throw new BadRequestException('reference is required');
    const result = await this.walletService.verifyWalletDeposit(
      user.id,
      reference,
    );

    return result;
  }

  @Post('payout/request')
  @Roles(UserRole.ARTISAN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Request wallet payout to bank account' })
  @ApiResponse({ status: 200, description: 'Payout requested successfully' })
  async requestPayout(
    @Body() withdrawFundsDto: WithdrawFundsDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const result = await this.walletService.requestWalletPayout(
      user.id,
      withdrawFundsDto.amount,
      withdrawFundsDto.bankCode,
      withdrawFundsDto.accountNumber,
    );

    return result;
  }

  @Post('payout/process')
  @Roles(UserRole.ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Process pending payout request (Admin only)' })
  @ApiResponse({ status: 200, description: 'Payout processed successfully' })
  async processPayout(
    @Body('transactionId') transactionId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    if (!transactionId)
      throw new BadRequestException('transactionId is required');
    const result = await this.walletService.processPayout(
      user.id,
      transactionId,
    );

    return result;
  }

  @Post('freeze-funds')
  @Roles(UserRole.ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Freeze funds in wallet' })
  @ApiResponse({ status: 200, description: 'Funds frozen successfully' })
  async freezeFunds(
    @Body() freezeFundsDto: FreezeFundsDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const result = await this.walletService.freezeFunds(
      user.id,
      freezeFundsDto.amount,
      freezeFundsDto.reference,
      freezeFundsDto.metadata,
    );

    return result;
  }

  @Post('unfreeze-funds')
  @Roles(UserRole.ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Unfreeze funds in wallet' })
  @ApiResponse({ status: 200, description: 'Funds released successfully' })
  async unfreezeFunds(
    @Body() freezeFundsDto: FreezeFundsDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const result = await this.walletService.unfreezeFunds(
      user.id,
      freezeFundsDto.amount,
      freezeFundsDto.reference,
      freezeFundsDto.metadata,
    );

    return result;
  }
}
