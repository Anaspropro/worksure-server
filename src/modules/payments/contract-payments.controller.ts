import {
  Controller,
  Post,
  Body,
  Param,
  UseGuards,
  HttpStatus,
  HttpCode,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { PaymentsService } from './payments.service';
import { FundContractDto } from '../contracts/dto/fund-contract.dto';
import { RefundContractDto } from '../contracts/dto/refund-contract.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../auth/auth.service';

@ApiTags('contracts')
@Controller('contracts')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class ContractPaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Post(':id/fund')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Fund a contract' })
  @ApiResponse({ status: 200, description: 'Contract funded successfully' })
  async fundContract(
    @Param('id') contractId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() fundDto: FundContractDto,
  ) {
    const contract = await this.paymentsService.initializeContractPayment(
      user.id,
      contractId,
      fundDto.email,
      fundDto.callbackUrl,
    );

    return {
      message: 'Contract payment initialized successfully',
      data: contract,
    };
  }

  @Post(':id/release-escrow')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Release escrow funds to artisan' })
  @ApiResponse({ status: 200, description: 'Escrow released successfully' })
  async releaseEscrow(
    @Param('id') contractId: string,
    @CurrentUser() _user: AuthenticatedUser,
  ) {
    const result = await this.paymentsService.releaseEscrow(contractId);

    return result;
  }

  @Post(':id/refund')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Refund contract to client' })
  @ApiResponse({ status: 200, description: 'Contract refunded successfully' })
  async refundContract(
    @Param('id') contractId: string,
    @Body() refundDto: RefundContractDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const result = await this.paymentsService.refundContract(
      contractId,
      user.id,
      user.role === 'ADMIN',
      refundDto.reason,
    );

    return result;
  }
}
