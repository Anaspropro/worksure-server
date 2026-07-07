import {
  BadRequestException,
  ForbiddenException,
  Body,
  Controller,
  Get,
  Headers,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AuthenticatedUser } from '../auth/auth.service';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../../common/constants/roles.constants';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { PrismaService } from '../../database/prisma.service';
import { PaymentsService } from './payments.service';
import { PaystackWebhookService } from './paystack-webhook.service';
import { WebhookSignatureService } from '../../common/services/webhook-signature.service';
import {
  ActivateContractDto,
  CompleteContractDto,
  PaymentFundContractDto,
  PaymentListQueryDto,
  PaystackInitDto,
  PaystackVerifyDto,
  VerifyPaymentDto,
  ReleasePaymentDto,
  RefundPaymentDto,
} from './dto/payment.dto';

@ApiTags('payments')
@Controller('payments')
@UseGuards(JwtAuthGuard, RolesGuard, ThrottlerGuard)
export class PaymentsController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly paymentsService: PaymentsService,
    private readonly webhookSignatureService: WebhookSignatureService,
    private readonly paystackWebhookService: PaystackWebhookService,
  ) {}



  @ApiBearerAuth('bearer')
  @ApiOperation({ summary: 'Initialize Paystack funding for a contract' })
  @ApiOkResponse({ description: 'Paystack checkout initialized.' })
  @ApiBadRequestResponse({ description: 'Invalid contract funding request.' })
  @Throttle({ default: { limit: 3, ttl: 60000 } })
  @Post('fund')
  async fundContract(
    @CurrentUser() user: { id: string },
    @Body() dto: PaymentFundContractDto,
  ) {
    const result = await this.paymentsService.initializeContractPayment(
      user.id,
      dto.contractId,
      dto.email,
      dto.callbackUrl,
    );

    return {
      message: 'Paystack checkout initialized successfully',
      data: result,
    };
  }

  @ApiBearerAuth('bearer')
  @ApiOperation({ summary: 'Initialize Paystack funding for a contract' })
  @ApiOkResponse({ description: 'Paystack checkout initialized.' })
  @Post('paystack/init')
  async initPaystack(
    @CurrentUser() user: { id: string },
    @Body() dto: PaystackInitDto,
  ) {
    const result = await this.paymentsService.initializeContractPayment(
      user.id,
      dto.contractId,
      dto.email,
      dto.callbackUrl,
    );

    return {
      message: 'Paystack initialization successful',
      data: result,
    };
  }

  @ApiBearerAuth('bearer')
  @ApiOperation({ summary: 'Verify Paystack payment after redirect' })
  @ApiOkResponse({ description: 'Paystack payment verified successfully.' })
  @Post('paystack/verify')
  async verifyPaystack(
    @CurrentUser() user: { id: string },
    @Body() dto: PaystackVerifyDto,
  ) {
    const result = await this.paymentsService.verifyPaystackPayment(
      dto.reference,
      user.id,
    );

    return {
      message: result.message,
      data: result,
    };
  }

  @Public()
  @UseGuards(ThrottlerGuard)
  @Post('paystack/webhook')
  async paystackWebhook(
    @Req() request: { rawBody?: Buffer; body: any },
    @Headers('x-paystack-signature') signature?: string,
  ) {
    if (!request.rawBody) {
      throw new BadRequestException('Raw body is required for webhook signature verification');
    }
    if (!signature) {
      throw new BadRequestException('Webhook signature is missing');
    }
    
    const secret = process.env.PAYSTACK_WEBHOOK_SECRET;
    if (!secret) {
      throw new BadRequestException('Webhook secret is not configured');
    }

    this.webhookSignatureService.verifyAndParseWebhook(
      request.rawBody.toString('utf8'),
      signature,
      secret,
    );
    const eventType = request.body?.event as string | undefined;
    const eventIdRaw = request.body?.data?.id;
    const eventReference = request.body?.data?.reference as string | undefined;
    const eventKey =
      (typeof eventIdRaw === 'string' || typeof eventIdRaw === 'number'
        ? String(eventIdRaw)
        : undefined) ||
      eventReference ||
      `${eventType ?? 'unknown'}:${JSON.stringify(request.body?.data ?? {})}`;

    const alreadyProcessed =
      await this.webhookSignatureService.isEventProcessed(eventKey);
    if (alreadyProcessed) {
      return {
        status: 'already_processed',
        event: eventType ?? 'unknown',
      };
    }

    const acquired =
      await this.webhookSignatureService.tryBeginEventProcessing(eventKey);
    if (!acquired) {
      return {
        status: 'already_processing',
        event: eventType ?? 'unknown',
      };
    }

    const result = await this.paystackWebhookService.processPaystackWebhook(
      request.body,
    );
    await this.webhookSignatureService.markEventProcessed(eventKey);

    return {
      status: 'success',
      data: result,
    };
  }

  @ApiBearerAuth('bearer')
  @ApiOperation({ summary: 'Manually verify a payment record' })
  @ApiOkResponse({ description: 'Payment verified successfully.' })
  @Post('verify')
  async verifyPayment(
    @CurrentUser() user: { id: string },
    @Body() dto: VerifyPaymentDto,
  ) {
    const result = await this.paymentsService.verifyPayment(
      user.id,
      dto.paymentId,
      dto.verificationCode,
    );

    return {
      message: 'Payment verified successfully',
      data: result,
    };
  }

  @ApiBearerAuth('bearer')
  @ApiOperation({ summary: 'Mark a funded contract as in progress' })
  @ApiOkResponse({ description: 'Contract activated successfully.' })
  @Post('activate')
  async activateContract(
    @CurrentUser() user: { id: string },
    @Body() dto: ActivateContractDto,
  ) {
    const result = await this.paymentsService.activateContract(
      dto.contractId,
      user.id,
    );

    return {
      message: 'Contract activated successfully',
      data: result,
    };
  }

  @ApiBearerAuth('bearer')
  @ApiOperation({ summary: 'Confirm contract completion' })
  @ApiOkResponse({ description: 'Completion recorded successfully.' })
  @Post('complete')
  async completeContract(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CompleteContractDto,
  ) {
    const result = await this.paymentsService.completeContract(
      dto.contractId,
      user.id,
      user.role === UserRole.CLIENT,
    );

    return {
      message: 'Completion recorded successfully',
      data: result,
    };
  }

  @ApiBearerAuth('bearer')
  @ApiOperation({ summary: 'Admin manual release of escrow (for disputes)' })
  @ApiOkResponse({ description: 'Escrow released successfully.' })
  @Roles(UserRole.ADMIN)
  @Post('release/admin')
  async releaseEscrowAdmin(
    @CurrentUser() user: { id: string; role: string },
    @Body() dto: ReleasePaymentDto,
  ) {
    await this.paymentsService.releaseEscrowByAdmin(dto.contractId, dto.reason);

    return {
      message: 'Escrow release initiated successfully',
    };
  }

  @ApiBearerAuth('bearer')
  @ApiOperation({ summary: 'Refund a contract' })
  @ApiOkResponse({ description: 'Refund requested successfully.' })
  @Post('refund')
  async refundContract(
    @CurrentUser() user: { id: string; role: string },
    @Body() dto: RefundPaymentDto,
  ) {
    const isAdmin = user.role === 'ADMIN';
    const result = await this.paymentsService.refundContract(
      dto.contractId,
      user.id,
      isAdmin,
      dto.reason,
    );

    return {
      message: 'Refund requested successfully',
      data: result,
    };
  }

  @Public()
  @Get('banks')
  @ApiOperation({ summary: 'List supported banks from Paystack' })
  @ApiOkResponse({ description: 'List of banks.' })
  async getBanks() {
    const banks = await this.paymentsService.getBanks();
    return { data: banks ?? [] };
  }

  @ApiBearerAuth('bearer')
  @ApiOperation({ summary: 'List payments related to the current user' })
  @ApiOkResponse({ description: 'Payments retrieved successfully.' })
  @Get()
  async listPayments(
    @CurrentUser() user: { id: string },
    @Query() query: PaymentListQueryDto,
  ) {
    return this.paymentsService.listPayments(user.id, query);
  }
}
