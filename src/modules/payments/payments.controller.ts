import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Headers,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
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
import { WebhookSignatureService } from '../../common/services/webhook-signature.service';
import {
  ActivateContractDto,
  CompleteContractDto,
  PaymentFundContractDto,
  PaymentListQueryDto,
  PaystackInitDto,
  PaystackVerifyDto,
  VerifyPaymentDto,
} from './dto/payment.dto';

@ApiTags('payments')
@Controller('payments')
@UseGuards(JwtAuthGuard, RolesGuard, ThrottlerGuard)
export class PaymentsController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly paymentsService: PaymentsService,
    private readonly webhookSignatureService: WebhookSignatureService,
  ) {}

  private verifyWebhookSignature(
    signature: string | undefined,
    rawBody: Buffer | undefined,
  ) {
    const secret =
      process.env.PAYSTACK_WEBHOOK_SECRET ?? process.env.PAYSTACK_SECRET_KEY;

    if (!secret || !signature || !rawBody) {
      throw new BadRequestException('Invalid webhook signature');
    }

    const computed = createHmac('sha512', secret).update(rawBody).digest('hex');
    const signatureBuffer = Buffer.from(signature, 'hex');
    const computedBuffer = Buffer.from(computed, 'hex');

    if (
      signatureBuffer.length !== computedBuffer.length ||
      !timingSafeEqual(signatureBuffer, computedBuffer)
    ) {
      throw new BadRequestException('Invalid webhook signature');
    }
  }

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
  async verifyPaystack(@Body() dto: PaystackVerifyDto) {
    const result = await this.paymentsService.verifyPaystackPayment(
      dto.reference,
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
    this.verifyWebhookSignature(signature, request.rawBody);
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

    const result = await this.paymentsService.processPaystackWebhook(request.body);
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
  async verifyPayment(@Body() dto: VerifyPaymentDto) {
    const result = await this.paymentsService.verifyPayment(
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
    @CurrentUser() user: { id: string },
    @Body() dto: CompleteContractDto,
  ) {
    const result = await this.paymentsService.completeContract(
      dto.contractId,
      user.id,
      dto.role === 'client',
    );

    return {
      message: 'Completion recorded successfully',
      data: result,
    };
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

  @Public()
  @Post('webhook')
  async handlePaystackWebhook(
    @Req() req: any,
    @Headers('x-paystack-signature') signature: string,
  ) {
    return this.paystackWebhook(req, signature);
  }
}
