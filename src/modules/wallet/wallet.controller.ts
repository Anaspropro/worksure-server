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

@ApiTags('wallet')
@Controller('wallet')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class WalletController {
  constructor(private readonly walletService: WalletService) {}

  @Get('balance')
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
  @ApiOperation({ summary: 'Create a wallet for the user' })
  @ApiResponse({ status: 201, description: 'Wallet created successfully' })
  async createWallet(@CurrentUser() user: AuthenticatedUser) {
    const wallet = await this.walletService.createWallet(user.id);

    return {
      message: 'Wallet created successfully',
      data: wallet,
    };
  }

  @Post('add-funds')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Add funds to wallet' })
  @ApiResponse({ status: 200, description: 'Funds added successfully' })
  async addFunds(
    @Body() addFundsDto: AddFundsDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const result = await this.walletService.addFunds(
      user.id,
      addFundsDto.amount,
      addFundsDto.reference,
      addFundsDto.metadata,
    );

    return result;
  }

  @Post('withdraw-funds')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Withdraw funds from wallet' })
  @ApiResponse({ status: 200, description: 'Funds withdrawn successfully' })
  async withdrawFunds(
    @Body() withdrawFundsDto: WithdrawFundsDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const result = await this.walletService.withdrawFunds(
      user.id,
      withdrawFundsDto.amount,
      withdrawFundsDto.reference,
      withdrawFundsDto.metadata,
    );

    return result;
  }

  @Post('freeze-funds')
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
