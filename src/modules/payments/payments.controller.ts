import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  Query,
  UseGuards,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiNotFoundResponse,
  ApiForbiddenResponse,
  ApiBadRequestResponse,
  ApiOperation,
  ApiTags,
  ApiQuery,
  ApiParam,
} from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { UserRole } from '../../common/constants/roles.constants';
import { PrismaService } from '../../database/prisma.service';
import { randomUUID } from 'node:crypto';
import {
  FundContractDto,
  VerifyPaymentDto,
  ActivateContractDto,
  CompleteContractDto,
  ConfirmCompletionDto,
  PaymentResponseDto,
  PaymentListQueryDto,
} from './dto/payment.dto';
import { $Enums, ContractStatus, TransactionType, TransactionStatus } from '../../generated/prisma';

@ApiTags('payments')
@Controller('payments')
export class PaymentsController {
  constructor(private readonly prisma: PrismaService) {}

  private ensureOwnerOrAdmin(
    user: { id: string; role: $Enums.UserRole },
    paymentUserId: string,
  ) {
    const isOwner = user.id === paymentUserId;
    const isAdmin = user.role === UserRole.ADMIN;
    
    if (!isOwner && !isAdmin) {
      throw new ForbiddenException('Access denied: You can only manage your own payments');
    }
  }

  private ensureContractParticipantOrAdmin(
    user: { id: string; role: $Enums.UserRole },
    clientId: string,
    artisanId: string,
  ) {
    const isClient = user.id === clientId;
    const isArtisan = user.id === artisanId;
    const isAdmin = user.role === UserRole.ADMIN;
    
    if (!isClient && !isArtisan && !isAdmin) {
      throw new ForbiddenException('Access denied: You can only manage contracts you participate in');
    }
  }

  @ApiBearerAuth('bearer')
  @ApiOperation({ summary: 'Fund a contract' })
  @ApiOkResponse({ description: 'Contract funded successfully.' })
  @ApiNotFoundResponse({ description: 'Contract not found.' })
  @ApiForbiddenResponse({ description: 'Access denied.' })
  @ApiBadRequestResponse({ description: 'Invalid funding data.' })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Post('fund')
  async fundContract(
    @CurrentUser() user: { id: string; role: $Enums.UserRole },
    @Body() fundDto: FundContractDto,
  ): Promise<PaymentResponseDto> {
    const contract = await this.prisma.contract.findUnique({
      where: { id: fundDto.contractId },
      include: {
        client: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    if (!contract) {
      throw new NotFoundException('Contract not found');
    }

    // Check if user is the client
    if (user.role !== UserRole.ADMIN && contract.clientId !== user.id) {
      throw new ForbiddenException('Only the client can fund the contract');
    }

    // Check contract status
    if (contract.status !== ContractStatus.DRAFT) {
      throw new BadRequestException('Contract must be in DRAFT status to be funded');
    }

    // Check if already funded
    const existingPayment = await this.prisma.payment.findFirst({
      where: {
        contractId: fundDto.contractId,
        status: 'completed',
      },
    });

    if (existingPayment) {
      throw new BadRequestException('Contract is already funded');
    }

    // Create payment record
    const payment = await this.prisma.$transaction(async (tx) => {
      const newPayment = await tx.payment.create({
        data: {
          id: randomUUID(),
          contractId: fundDto.contractId,
          userId: user.id,
          amount: fundDto.amount,
          status: 'pending',
          paymentMethod: fundDto.paymentMethod || null,
          paymentReference: fundDto.paymentReference || null,
          verificationCode: Math.random().toString(36).substring(2, 8).toUpperCase(),
          isVerified: false,
          createdAt: new Date(),
        },
      });

      return newPayment;
    });

    return this.formatPaymentResponse(payment);
  }

  @ApiBearerAuth('bearer')
  @ApiOperation({ summary: 'Verify a payment' })
  @ApiOkResponse({ description: 'Payment verified successfully.' })
  @ApiNotFoundResponse({ description: 'Payment not found.' })
  @ApiForbiddenResponse({ description: 'Access denied.' })
  @ApiBadRequestResponse({ description: 'Invalid verification data.' })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Post('verify')
  async verifyPayment(
    @CurrentUser() user: { id: string; role: $Enums.UserRole },
    @Body() verifyDto: VerifyPaymentDto,
  ): Promise<PaymentResponseDto> {
    const payment = await this.prisma.payment.findUnique({
      where: { id: verifyDto.paymentId },
      include: {
        contract: {
          include: {
            client: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
          },
        },
      },
    });

    if (!payment) {
      throw new NotFoundException('Payment not found');
    }

    // Check if user is the client
    if (user.role !== UserRole.ADMIN && payment.contract.clientId !== user.id) {
      throw new ForbiddenException('Only the client can verify the payment');
    }

    if (payment.isVerified) {
      throw new BadRequestException('Payment is already verified');
    }

    if (payment.verificationCode !== verifyDto.verificationCode) {
      throw new BadRequestException('Invalid verification code');
    }

    // Verify payment and update contract
    const updatedPayment = await this.prisma.$transaction(async (tx) => {
      // Update payment
      const updated = await tx.payment.update({
        where: { id: verifyDto.paymentId },
        data: {
          status: 'completed',
          isVerified: true,
          verifiedAt: new Date(),
        },
      });

      // Update contract status to ACTIVE
      await tx.contract.update({
        where: { id: payment.contractId },
        data: {
          status: ContractStatus.ACTIVE,
          fundedAt: new Date(),
        },
      });

      return updated;
    });

    return this.formatPaymentResponse(updatedPayment);
  }

  @ApiBearerAuth('bearer')
  @ApiOperation({ summary: 'Activate a contract' })
  @ApiOkResponse({ description: 'Contract activated successfully.' })
  @ApiNotFoundResponse({ description: 'Contract not found.' })
  @ApiForbiddenResponse({ description: 'Access denied.' })
  @ApiBadRequestResponse({ description: 'Invalid activation data.' })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Post('activate')
  async activateContract(
    @CurrentUser() user: { id: string; role: $Enums.UserRole },
    @Body() activateDto: ActivateContractDto,
  ): Promise<any> {
    const contract = await this.prisma.contract.findUnique({
      where: { id: activateDto.contractId },
      include: {
        client: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        artisan: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    if (!contract) {
      throw new NotFoundException('Contract not found');
    }

    // Check if user is participant
    this.ensureContractParticipantOrAdmin(user, contract.clientId, contract.artisanId);

    if (contract.status !== ContractStatus.ACTIVE) {
      throw new BadRequestException('Contract must be ACTIVE to be activated');
    }

    // Check if already started
    if (contract.startedAt) {
      throw new BadRequestException('Contract is already started');
    }

    // Activate contract
    const updatedContract = await this.prisma.contract.update({
      where: { id: activateDto.contractId },
      data: {
        status: ContractStatus.ACTIVE,
        startedAt: new Date(),
      },
    });

    return {
      message: 'Contract activated successfully',
      contract: this.formatContractResponse(updatedContract),
    };
  }

  @ApiBearerAuth('bearer')
  @ApiOperation({ summary: 'Complete a contract' })
  @ApiOkResponse({ description: 'Contract completion initiated successfully.' })
  @ApiNotFoundResponse({ description: 'Contract not found.' })
  @ApiForbiddenResponse({ description: 'Access denied.' })
  @ApiBadRequestResponse({ description: 'Invalid completion data.' })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Post('complete')
  async completeContract(
    @CurrentUser() user: { id: string; role: $Enums.UserRole },
    @Body() completeDto: CompleteContractDto,
  ): Promise<any> {
    const contract = await this.prisma.contract.findUnique({
      where: { id: completeDto.contractId },
      include: {
        client: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        artisan: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    if (!contract) {
      throw new NotFoundException('Contract not found');
    }

    // Check if user is participant
    this.ensureContractParticipantOrAdmin(user, contract.clientId, contract.artisanId);

    if (contract.status !== ContractStatus.ACTIVE) {
      throw new BadRequestException('Contract must be ACTIVE to be completed');
    }

    // Check if already completed
    if (contract.clientConfirmedCompletion && contract.artisanConfirmedCompletion) {
      throw new BadRequestException('Contract is already completed');
    }

    // Update completion status
    const updatedContract = await this.prisma.contract.update({
      where: { id: completeDto.contractId },
      data: {
        clientConfirmedCompletion: user.id === contract.clientId,
        artisanConfirmedCompletion: user.id === contract.artisanId,
        [user.id === contract.clientId ? 'clientConfirmedAt' : 'artisanConfirmedAt']: new Date(),
      },
    });

    // Check if both parties have confirmed
    if (updatedContract.clientConfirmedCompletion && updatedContract.artisanConfirmedCompletion) {
      await this.finalizeContractCompletion(updatedContract.id);
    }

    return {
      message: 'Contract completion confirmed',
      contract: this.formatContractResponse(updatedContract),
    };
  }

  @ApiBearerAuth('bearer')
  @ApiOperation({ summary: 'Confirm contract completion' })
  @ApiOkResponse({ description: 'Contract completion confirmed successfully.' })
  @ApiNotFoundResponse({ description: 'Contract not found.' })
  @ApiForbiddenResponse({ description: 'Access denied.' })
  @ApiBadRequestResponse({ description: 'Invalid confirmation data.' })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Post('confirm-completion')
  async confirmCompletion(
    @CurrentUser() user: { id: string; role: $Enums.UserRole },
    @Body() confirmDto: ConfirmCompletionDto,
  ): Promise<any> {
    const contract = await this.prisma.contract.findUnique({
      where: { id: confirmDto.contractId },
      include: {
        client: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        artisan: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    if (!contract) {
      throw new NotFoundException('Contract not found');
    }

    // Check if user is participant
    this.ensureContractParticipantOrAdmin(user, contract.clientId, contract.artisanId);

    if (contract.status !== ContractStatus.ACTIVE) {
      throw new BadRequestException('Contract must be ACTIVE to confirm completion');
    }

    // Update confirmation status
    const updateData: any = {
      [confirmDto.role === 'client' ? 'clientConfirmedCompletion' : 'artisanConfirmedCompletion']: true,
      [confirmDto.role === 'client' ? 'clientConfirmedAt' : 'artisanConfirmedAt']: new Date(),
    };

    const updatedContract = await this.prisma.contract.update({
      where: { id: confirmDto.contractId },
      data: updateData,
    });

    // Check if both parties have confirmed
    if (updatedContract.clientConfirmedCompletion && updatedContract.artisanConfirmedCompletion) {
      await this.finalizeContractCompletion(updatedContract.id);
    }

    return {
      message: 'Contract completion confirmed',
      contract: this.formatContractResponse(updatedContract),
    };
  }

  @ApiBearerAuth('bearer')
  @ApiOperation({ summary: 'List payments with filtering' })
  @ApiOkResponse({ description: 'Payments retrieved successfully.' })
  @ApiForbiddenResponse({ description: 'Authentication required.' })
  @ApiQuery({ name: 'contractId', required: false })
  @ApiQuery({ name: 'status', required: false })
  @ApiQuery({ name: 'verificationStatus', required: false })
  @ApiQuery({ name: 'dateFrom', required: false })
  @ApiQuery({ name: 'dateTo', required: false })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Get()
  async listPayments(
    @CurrentUser() user: { id: string; role: $Enums.UserRole },
    @Query() query: PaymentListQueryDto,
  ) {
    const { page = 1, limit = 10, contractId, status, verificationStatus, dateFrom, dateTo } = query;
    
    const skip = (page - 1) * limit;
    const take = Math.min(limit, 100);

    const where: any = {};

    if (user.role !== UserRole.ADMIN) {
      where.userId = user.id;
    }

    if (contractId) where.contractId = contractId;
    if (status) where.status = status;
    if (verificationStatus) {
      where.isVerified = verificationStatus === 'verified';
    }
    if (dateFrom || dateTo) {
      where.createdAt = {};
      if (dateFrom) where.createdAt.gte = new Date(dateFrom);
      if (dateTo) where.createdAt.lte = new Date(dateTo);
    }

    const [payments, total] = await Promise.all([
      this.prisma.payment.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.payment.count({ where }),
    ]);

    return {
      payments: payments.map(payment => this.formatPaymentResponse(payment)),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasNext: page * limit < total,
        hasPrev: page > 1,
      },
    };
  }

  private async finalizeContractCompletion(contractId: string) {
    await this.prisma.$transaction(async (tx) => {
      // Update contract status to COMPLETED
      await tx.contract.update({
        where: { id: contractId },
        data: {
          status: ContractStatus.COMPLETED,
          completedAt: new Date(),
        },
      });

      // Get contract details for payment processing
      const contract = await tx.contract.findUnique({
        where: { id: contractId },
      });

      if (contract) {
        // Release escrow to artisan
        await tx.wallet.update({
          where: { userId: contract.artisanId },
          data: {
            frozen: {
              decrement: contract.amount,
            },
            version: {
              increment: 1,
            },
          },
        });

        // Create release transaction for artisan
        await tx.transaction.create({
          data: {
            id: randomUUID(),
            userId: contract.artisanId,
            type: TransactionType.ESCROW_RELEASE,
            amount: contract.amount,
            status: TransactionStatus.COMPLETED,
            reference: contractId,
            metadata: { action: 'contract_completion', contractId },
            createdAt: new Date(),
            completedAt: new Date(),
          },
        });

        // Deduct platform fee from client's wallet
        const platformFee = Math.floor(contract.amount * 0.05); // 5% platform fee
        await tx.wallet.update({
          where: { userId: contract.clientId },
          data: {
            balance: {
              decrement: platformFee,
            },
            version: {
              increment: 1,
            },
          },
        });

        // Create platform fee transaction
        await tx.transaction.create({
          data: {
            id: randomUUID(),
            userId: contract.clientId,
            type: TransactionType.PLATFORM_FEE,
            amount: platformFee,
            status: TransactionStatus.COMPLETED,
            reference: contractId,
            metadata: { action: 'platform_fee', contractId },
            createdAt: new Date(),
            completedAt: new Date(),
          },
        });
      }
    });
  }

  private formatPaymentResponse(payment: any): PaymentResponseDto {
    return {
      id: payment.id,
      contractId: payment.contractId,
      userId: payment.userId,
      amount: payment.amount,
      status: payment.status,
      paymentMethod: payment.paymentMethod || null,
      paymentReference: payment.paymentReference || null,
      verificationCode: payment.verificationCode || null,
      isVerified: payment.isVerified,
      createdAt: payment.createdAt.toISOString(),
      verifiedAt: payment.verifiedAt?.toISOString() || null,
      completedAt: payment.completedAt?.toISOString() || null,
    };
  }

  private formatContractResponse(contract: any): any {
    return {
      id: contract.id,
      jobId: contract.jobId,
      proposalId: contract.proposalId,
      clientId: contract.clientId,
      artisanId: contract.artisanId,
      amount: contract.amount,
      status: contract.status,
      fundedAt: contract.fundedAt?.toISOString() || null,
      activatedAt: contract.activatedAt?.toISOString() || null,
      startedAt: contract.startedAt?.toISOString() || null,
      completedAt: contract.completedAt?.toISOString() || null,
      clientConfirmedCompletion: contract.clientConfirmedCompletion,
      clientConfirmedAt: contract.clientConfirmedAt?.toISOString() || null,
      artisanConfirmedCompletion: contract.artisanConfirmedCompletion,
      artisanConfirmedAt: contract.artisanConfirmedAt?.toISOString() || null,
      escrowReleased: contract.escrowReleased,
      escrowReleasedAt: contract.escrowReleasedAt?.toISOString() || null,
      platformFeeDeducted: contract.platformFeeDeducted,
      createdAt: contract.createdAt.toISOString(),
      updatedAt: contract.updatedAt.toISOString(),
    };
  }
}
