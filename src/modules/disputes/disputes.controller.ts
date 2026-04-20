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
import {
  CreateDisputeDto,
  UpdateDisputeDto,
  DisputeResponseDto,
  DisputeListQueryDto,
} from './dto/dispute.dto';
import { $Enums, DisputeStatus } from '../../generated/prisma';
import { DisputesService } from './disputes.service';

@ApiTags('disputes')
@Controller('disputes')
export class DisputesController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly disputesService: DisputesService,
  ) {}

  private ensureDisputeParticipantOrAdmin(
    user: { id: string; role: $Enums.UserRole },
    clientId: string,
    artisanId: string,
  ) {
    const isClient = user.id === clientId;
    const isArtisan = user.id === artisanId;
    const isAdmin = user.role === UserRole.ADMIN;

    if (!isClient && !isArtisan && !isAdmin) {
      throw new ForbiddenException(
        'Access denied: You can only manage disputes you participate in',
      );
    }
  }

  @ApiBearerAuth('bearer')
  @ApiOperation({ summary: 'Create a new dispute' })
  @ApiOkResponse({ description: 'Dispute created successfully.' })
  @ApiNotFoundResponse({ description: 'Contract or job not found.' })
  @ApiForbiddenResponse({ description: 'Access denied.' })
  @ApiBadRequestResponse({ description: 'Invalid dispute data.' })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Post()
  async createDispute(
    @CurrentUser() user: { id: string; role: $Enums.UserRole },
    @Body() createDto: CreateDisputeDto,
  ): Promise<DisputeResponseDto> {
    const dispute = await this.disputesService.createDispute(
      user.id,
      createDto.amount,
      createDto.description,
      createDto.contractId,
      createDto.jobId,
      createDto.evidenceImages,
      createDto.evidenceVideos,
      createDto.evidenceMessages,
    );

    return this.formatDisputeResponse(dispute);
  }

  @ApiBearerAuth('bearer')
  @ApiOperation({ summary: 'List disputes with filtering' })
  @ApiOkResponse({ description: 'Disputes retrieved successfully.' })
  @ApiForbiddenResponse({ description: 'Authentication required.' })
  @ApiQuery({ name: 'status', required: false, enum: DisputeStatus })
  @ApiQuery({ name: 'contractId', required: false })
  @ApiQuery({ name: 'jobId', required: false })
  @ApiQuery({ name: 'clientId', required: false })
  @ApiQuery({ name: 'artisanId', required: false })
  @ApiQuery({ name: 'dateFrom', required: false })
  @ApiQuery({ name: 'dateTo', required: false })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Get()
  async listDisputes(
    @CurrentUser() user: { id: string; role: $Enums.UserRole },
    @Query() query: DisputeListQueryDto,
  ) {
    const {
      page = 1,
      limit = 10,
      status,
      contractId,
      jobId,
      clientId,
      artisanId,
      dateFrom,
      dateTo,
    } = query;

    const skip = (page - 1) * limit;
    const take = Math.min(limit, 100);

    const where: any = {};

    // Non-admin users can only see disputes they participate in
    if (user.role !== UserRole.ADMIN) {
      where.OR = [{ clientId: user.id }, { artisanId: user.id }];
    }

    if (status) where.status = status;
    if (contractId) where.contractId = contractId;
    if (jobId) where.jobId = jobId;
    if (clientId) where.clientId = clientId;
    if (artisanId) where.artisanId = artisanId;
    if (dateFrom || dateTo) {
      where.createdAt = {};
      if (dateFrom) where.createdAt.gte = new Date(dateFrom);
      if (dateTo) where.createdAt.lte = new Date(dateTo);
    }

    const [disputes, total] = await Promise.all([
      this.prisma.dispute.findMany({
        where,
        skip,
        take,
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.dispute.count({ where }),
    ]);

    return {
      disputes: disputes.map((dispute) => this.formatDisputeResponse(dispute)),
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

  @ApiBearerAuth('bearer')
  @ApiOperation({ summary: 'Get current user disputes' })
  @ApiOkResponse({ description: 'User disputes retrieved successfully.' })
  @ApiForbiddenResponse({ description: 'Authentication required.' })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Get('me')
  async getMyDisputes(
    @CurrentUser() user: { id: string; role: $Enums.UserRole },
  ) {
    const disputes = await this.disputesService.getDisputesByUser(user.id);

    return disputes.map((dispute) => this.formatDisputeResponse(dispute));
  }

  @ApiBearerAuth('bearer')
  @ApiOperation({ summary: 'Get dispute by ID' })
  @ApiOkResponse({ description: 'Dispute retrieved successfully.' })
  @ApiNotFoundResponse({ description: 'Dispute not found.' })
  @ApiForbiddenResponse({ description: 'Access denied.' })
  @ApiParam({ name: 'id', description: 'Dispute ID' })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Get(':id')
  async getDispute(
    @CurrentUser() user: { id: string; role: $Enums.UserRole },
    @Param('id') id: string,
  ): Promise<DisputeResponseDto> {
    const dispute = await this.disputesService.getDisputeById(id, user.id);

    return this.formatDisputeResponse(dispute);
  }

  @ApiBearerAuth('bearer')
  @ApiOperation({ summary: 'Update dispute (Admin only)' })
  @ApiOkResponse({ description: 'Dispute updated successfully.' })
  @ApiNotFoundResponse({ description: 'Dispute not found.' })
  @ApiForbiddenResponse({ description: 'Admin access required.' })
  @ApiBadRequestResponse({ description: 'Invalid update data.' })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @Patch(':id')
  async updateDispute(
    @CurrentUser() user: { id: string; role: $Enums.UserRole },
    @Param('id') id: string,
    @Body() updateDto: UpdateDisputeDto,
  ): Promise<DisputeResponseDto> {
    const dispute = await this.prisma.dispute.findUnique({
      where: { id },
    });

    if (!dispute) {
      throw new NotFoundException('Dispute not found');
    }

    const updatedDispute = await this.disputesService.updateDispute(
      id,
      updateDto.status,
      updateDto.resolutionDecision,
      updateDto.resolutionNotes,
      user.id,
    );

    return this.formatDisputeResponse(updatedDispute);
  }

  private formatDisputeResponse(dispute: any): DisputeResponseDto {
    return {
      id: dispute.id,
      contractId: dispute.contractId || undefined,
      jobId: dispute.jobId || undefined,
      clientId: dispute.clientId,
      artisanId: dispute.artisanId,
      amount: dispute.amount,
      status: dispute.status,
      description: dispute.evidenceMessages?.[0] || '', // First message as description
      evidenceImages: dispute.evidenceImages || undefined,
      evidenceVideos: dispute.evidenceVideos || undefined,
      evidenceMessages: dispute.evidenceMessages || undefined,
      resolutionDecision: dispute.resolutionDecision || undefined,
      resolutionNotes: dispute.resolutionNotes || undefined,
      resolvedBy: dispute.resolvedBy || undefined,
      createdAt: dispute.createdAt.toISOString(),
      resolvedAt: dispute.resolvedAt?.toISOString() || undefined,
    };
  }
}
