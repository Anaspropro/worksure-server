import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  Query,
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
import { ContractsService } from './contracts.service';
import { CreateContractDto } from './dto/create-contract.dto';
import { FundContractDto } from './dto/fund-contract.dto';
import { ConfirmCompletionDto } from './dto/confirm-completion.dto';
import { RefundContractDto } from './dto/refund-contract.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ContractStatus } from '../../generated/prisma';
import { PaymentsService } from '../payments/payments.service';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../auth/auth.service';

@ApiTags('contracts')
@Controller('contracts')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class ContractsController {
  constructor(
    private readonly contractsService: ContractsService,
    private readonly paymentsService: PaymentsService,
  ) {}

  @Post()
  @ApiOperation({ summary: 'Create a contract from an accepted proposal' })
  @ApiResponse({ status: 201, description: 'Contract created successfully' })
  async createContract(
    @Body() createContractDto: CreateContractDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const contract = await this.contractsService.createContract(
      createContractDto.proposalId,
      user.id,
    );

    return {
      message: 'Contract created successfully',
      data: contract,
    };
  }

  @Post(':id/activate')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Activate a funded contract' })
  @ApiResponse({ status: 200, description: 'Contract activated successfully' })
  async activateContract(
    @Param('id') contractId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const contract = await this.contractsService.activateContract(
      contractId,
      user.id,
    );

    return {
      message: 'Contract activated successfully',
      data: contract,
    };
  }

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
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const result = await this.paymentsService.releaseEscrow(
      contractId,
      user.id,
    );

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
      refundDto.reason,
    );

    return result;
  }

  @Post(':id/confirm-completion')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Confirm contract completion' })
  @ApiResponse({
    status: 200,
    description: 'Completion confirmed successfully',
  })
  async confirmCompletion(
    @Param('id') contractId: string,
    @Body() confirmDto: ConfirmCompletionDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    // Verify user is part of the contract
    const contract = await this.contractsService.getContract(
      contractId,
      user.id,
    );

    // Verify role matches user type
    const isClient = contract.clientId === user.id;
    if (confirmDto.isClient !== isClient) {
      throw new Error('Role does not match user type');
    }

    // Confirm completion using centralized state management
    await this.contractsService.confirmCompletion(
      contractId,
      user.id,
      isClient,
    );

    // Get updated contract status
    const updatedContract = await this.contractsService.getContract(
      contractId,
      user.id,
    );

    let message = '';
    switch (updatedContract.status) {
      case ContractStatus.CLIENT_CONFIRMED:
        message =
          'Client confirmation recorded. Waiting for artisan confirmation.';
        break;
      case ContractStatus.READY_FOR_PAYOUT:
        message = 'Both parties confirmed. Contract is ready for payout.';
        break;
      default:
        message = 'Completion confirmed successfully';
    }

    return {
      message,
      contract: updatedContract,
      status: updatedContract.status,
      readyForPayout:
        updatedContract.status === ContractStatus.READY_FOR_PAYOUT,
    };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get contract details' })
  @ApiResponse({ status: 200, description: 'Contract retrieved successfully' })
  async getContract(
    @Param('id') contractId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const contract = await this.contractsService.getContract(
      contractId,
      user.id,
    );

    return {
      data: contract,
    };
  }

  @Get()
  @ApiOperation({ summary: 'Get user contracts' })
  @ApiResponse({ status: 200, description: 'Contracts retrieved successfully' })
  async getUserContracts(
    @CurrentUser() user: AuthenticatedUser,
    @Query('status') status?: ContractStatus,
  ) {
    const contracts = await this.contractsService.getUserContracts(
      user.id,
      status,
    );

    return {
      data: contracts,
    };
  }
}
