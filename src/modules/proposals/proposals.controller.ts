import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
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
  ApiCreatedResponse,
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
  CreateProposalDto,
  UpdateProposalDto,
  ProposalResponseDto,
  ProposalListQueryDto,
  ProposalActionDto,
} from './dto/create-proposal.dto';
import { $Enums, ProposalStatus, JobStatus } from '../../generated/prisma';

@ApiTags('proposals')
@Controller('proposals')
export class ProposalsController {
  constructor(private readonly prisma: PrismaService) {}

  private ensureArtisanRole(user: { role: $Enums.UserRole }) {
    if (user.role !== UserRole.ARTISAN) {
      throw new ForbiddenException('Artisan access required');
    }
  }

  private ensureClientRole(user: { role: $Enums.UserRole }) {
    if (user.role !== UserRole.CLIENT) {
      throw new ForbiddenException('Client access required');
    }
  }

  private ensureOwnerOrAdmin(
    user: { id: string; role: $Enums.UserRole },
    proposalUserId: string,
  ) {
    const isOwner = user.id === proposalUserId;
    const isAdmin = user.role === UserRole.ADMIN;
    
    if (!isOwner && !isAdmin) {
      throw new ForbiddenException('Access denied: You can only manage your own proposals');
    }
  }

  private ensureJobOwnerOrAdmin(
    user: { id: string; role: $Enums.UserRole },
    jobClientId: string,
  ) {
    const isOwner = user.id === jobClientId;
    const isAdmin = user.role === UserRole.ADMIN;
    
    if (!isOwner && !isAdmin) {
      throw new ForbiddenException('Access denied: You can only manage proposals for your own jobs');
    }
  }

  @ApiBearerAuth('bearer')
  @ApiOperation({ summary: 'Create a new proposal' })
  @ApiCreatedResponse({ description: 'Proposal created successfully.' })
  @ApiForbiddenResponse({ description: 'Artisan access required.' })
  @ApiNotFoundResponse({ description: 'Job not found.' })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ARTISAN)
  @Post()
  async createProposal(
    @CurrentUser() user: { id: string; role: $Enums.UserRole },
    @Body() createDto: CreateProposalDto,
  ): Promise<ProposalResponseDto> {
    this.ensureArtisanRole(user);

    // Check if job exists and is OPEN
    const job = await this.prisma.job.findUnique({
      where: { id: createDto.jobId },
    });

    if (!job) {
      throw new NotFoundException('Job not found');
    }

    if (job.status !== JobStatus.OPEN) {
      throw new BadRequestException('Proposals can only be created for open jobs');
    }

    // Check if user already has a proposal for this job
    const existingProposal = await this.prisma.proposal.findFirst({
      where: {
        jobId: createDto.jobId,
        artisanId: user.id,
        status: { notIn: [ProposalStatus.WITHDRAWN, ProposalStatus.REJECTED] },
      },
    });

    if (existingProposal) {
      throw new BadRequestException('You already have an active proposal for this job');
    }

    const proposal = await this.prisma.proposal.create({
      data: {
        id: randomUUID(),
        jobId: createDto.jobId,
        artisanId: user.id,
        clientId: job.clientId,
        message: createDto.message,
        amount: createDto.amount,
        status: ProposalStatus.PENDING,
      },
      include: {
        job: {
          select: {
            id: true,
            title: true,
            description: true,
            budget: true,
            status: true,
          },
        },
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

    return this.formatProposalResponse(proposal);
  }

  @ApiOperation({ summary: 'List proposals with filtering and pagination' })
  @ApiOkResponse({ description: 'Proposals retrieved successfully.' })
  @ApiQuery({ name: 'status', required: false, enum: ProposalStatus })
  @ApiQuery({ name: 'jobId', required: false })
  @ApiQuery({ name: 'clientId', required: false })
  @ApiQuery({ name: 'artisanId', required: false })
  @ApiQuery({ name: 'search', required: false })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @Get()
  async listProposals(@Query() query: ProposalListQueryDto) {
    const { page = 1, limit = 10, status, jobId, clientId, artisanId, search } = query;
    
    const skip = (page - 1) * limit;
    const take = Math.min(limit, 100);

    const where: any = {};

    if (status) where.status = status;
    if (jobId) where.jobId = jobId;
    if (clientId) where.clientId = clientId;
    if (artisanId) where.artisanId = artisanId;
    if (search) {
      where.OR = [
        { message: { contains: search, mode: 'insensitive' } },
        { notes: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [proposals, total] = await Promise.all([
      this.prisma.proposal.findMany({
        where,
        skip,
        take,
        include: {
          job: {
            select: {
              id: true,
              title: true,
              description: true,
              budget: true,
              status: true,
            },
          },
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
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.proposal.count({ where }),
    ]);

    return {
      proposals: proposals.map(proposal => this.formatProposalResponse(proposal)),
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

  @ApiOperation({ summary: 'Get proposal by ID' })
  @ApiOkResponse({ description: 'Proposal retrieved successfully.' })
  @ApiNotFoundResponse({ description: 'Proposal not found.' })
  @ApiParam({ name: 'id', description: 'Proposal ID' })
  @Get(':id')
  async getProposal(@Param('id') id: string) {
    const proposal = await this.prisma.proposal.findUnique({
      where: { id },
      include: {
        job: {
          select: {
            id: true,
            title: true,
            description: true,
            budget: true,
            status: true,
          },
        },
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

    if (!proposal) {
      throw new NotFoundException('Proposal not found');
    }

    return this.formatProposalResponse(proposal);
  }

  @ApiBearerAuth('bearer')
  @ApiOperation({ summary: 'Update proposal' })
  @ApiOkResponse({ description: 'Proposal updated successfully.' })
  @ApiNotFoundResponse({ description: 'Proposal not found.' })
  @ApiForbiddenResponse({ description: 'Access denied.' })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ARTISAN, UserRole.ADMIN)
  @Patch(':id')
  async updateProposal(
    @CurrentUser() user: { id: string; role: $Enums.UserRole },
    @Param('id') id: string,
    @Body() updateDto: UpdateProposalDto,
  ): Promise<ProposalResponseDto> {
    const existingProposal = await this.prisma.proposal.findUnique({
      where: { id },
    });

    if (!existingProposal) {
      throw new NotFoundException('Proposal not found');
    }

    // Check ownership (artisan can update their own proposals, admin can update any)
    if (user.role !== UserRole.ADMIN) {
      this.ensureOwnerOrAdmin(user, existingProposal.artisanId);
    }

    // Prevent updates if proposal is not pending
    if (existingProposal.status === ProposalStatus.ACCEPTED || existingProposal.status === ProposalStatus.REJECTED) {
      throw new BadRequestException('Cannot update proposal in current status');
    }

    const updateData: any = {};
    if (updateDto.message !== undefined) updateData.message = updateDto.message;
    if (updateDto.amount !== undefined) updateData.amount = updateDto.amount;

    const updatedProposal = await this.prisma.proposal.update({
      where: { id },
      data: updateData,
      include: {
        job: {
          select: {
            id: true,
            title: true,
            description: true,
            budget: true,
            status: true,
          },
        },
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

    return this.formatProposalResponse(updatedProposal);
  }

  @ApiBearerAuth('bearer')
  @ApiOperation({ summary: 'Withdraw proposal' })
  @ApiOkResponse({ description: 'Proposal withdrawn successfully.' })
  @ApiNotFoundResponse({ description: 'Proposal not found.' })
  @ApiForbiddenResponse({ description: 'Access denied.' })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ARTISAN, UserRole.ADMIN)
  @Patch(':id/withdraw')
  async withdrawProposal(
    @CurrentUser() user: { id: string; role: $Enums.UserRole },
    @Param('id') id: string,
  ): Promise<{ message: string }> {
    const existingProposal = await this.prisma.proposal.findUnique({
      where: { id },
    });

    if (!existingProposal) {
      throw new NotFoundException('Proposal not found');
    }

    // Check ownership (artisan can withdraw their own proposals, admin can withdraw any)
    if (user.role !== UserRole.ADMIN) {
      this.ensureOwnerOrAdmin(user, existingProposal.artisanId);
    }

    // Prevent withdrawal if proposal is already accepted or rejected
    if (existingProposal.status === ProposalStatus.ACCEPTED || existingProposal.status === ProposalStatus.REJECTED) {
      throw new BadRequestException('Cannot withdraw proposal in current status');
    }

    await this.prisma.proposal.update({
      where: { id },
      data: {
        status: ProposalStatus.WITHDRAWN,
      },
    });

    return { message: 'Proposal withdrawn successfully' };
  }

  @ApiBearerAuth('bearer')
  @ApiOperation({ summary: 'Accept proposal' })
  @ApiOkResponse({ description: 'Proposal accepted successfully.' })
  @ApiNotFoundResponse({ description: 'Proposal not found.' })
  @ApiForbiddenResponse({ description: 'Access denied.' })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.CLIENT, UserRole.ADMIN)
  @Patch(':id/accept')
  async acceptProposal(
    @CurrentUser() user: { id: string; role: $Enums.UserRole },
    @Param('id') id: string,
  ): Promise<ProposalResponseDto> {
    const existingProposal = await this.prisma.proposal.findUnique({
      where: { id },
      include: {
        job: {
          select: {
            id: true,
            clientId: true,
            status: true,
          },
        },
      },
    });

    if (!existingProposal) {
      throw new NotFoundException('Proposal not found');
    }

    // Check ownership (client can accept proposals for their jobs, admin can accept any)
    if (user.role !== UserRole.ADMIN) {
      this.ensureJobOwnerOrAdmin(user, existingProposal.job!.clientId);
    }

    // Prevent acceptance if proposal is not pending
    if (existingProposal.status !== ProposalStatus.PENDING) {
      throw new BadRequestException('Can only accept pending proposals');
    }

    // Update proposal status
    const updatedProposal = await this.prisma.proposal.update({
      where: { id },
      data: {
        status: ProposalStatus.ACCEPTED,
      },
      include: {
        job: {
          select: {
            id: true,
            clientId: true,
            status: true,
          },
        },
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

    return this.formatProposalResponse(updatedProposal);
  }

  @ApiBearerAuth('bearer')
  @ApiOperation({ summary: 'Reject proposal' })
  @ApiOkResponse({ description: 'Proposal rejected successfully.' })
  @ApiNotFoundResponse({ description: 'Proposal not found.' })
  @ApiForbiddenResponse({ description: 'Access denied.' })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.CLIENT, UserRole.ADMIN)
  @Patch(':id/reject')
  async rejectProposal(
    @CurrentUser() user: { id: string; role: $Enums.UserRole },
    @Param('id') id: string,
    @Body() body: ProposalActionDto,
  ): Promise<ProposalResponseDto> {
    const existingProposal = await this.prisma.proposal.findUnique({
      where: { id },
      include: {
        job: {
          select: {
            id: true,
            clientId: true,
            status: true,
          },
        },
      },
    });

    if (!existingProposal) {
      throw new NotFoundException('Proposal system not found');
    }

    // Check ownership (client can reject proposals for their jobs, admin can reject any)
    if (user.role !== UserRole.ADMIN) {
      this.ensureJobOwnerOrAdmin(user, existingProposal.job!.clientId);
    }

    // Prevent rejection if proposal is not pending
    if (existingProposal.status === ProposalStatus.ACCEPTED || existingProposal.status === ProposalStatus.REJECTED) {
      throw new BadRequestException('Can only reject pending proposals');
    }

    // Update proposal status
    const updatedProposal = await this.prisma.proposal.update({
      where: { id },
      data: {
        status: ProposalStatus.REJECTED,
      },
      include: {
        job: {
          select: {
            id: true,
            clientId: true,
            status: true,
          },
        },
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

    return this.formatProposalResponse(updatedProposal);
  }

  @ApiBearerAuth('bearer')
  @ApiOperation({ summary: 'Delete proposal' })
  @ApiOkResponse({ description: 'Proposal deleted successfully.' })
  @ApiNotFoundResponse({ description: 'Proposal not found.' })
  @ApiForbiddenResponse({ description: 'Access denied.' })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ARTISAN, UserRole.ADMIN)
  @Delete(':id')
  async deleteProposal(
    @CurrentUser() user: { id: string; role: $Enums.UserRole },
    @Param('id') id: string,
  ): Promise<{ message: string }> {
    const existingProposal = await this.prisma.proposal.findUnique({
      where: { id },
    });

    if (!existingProposal) {
      throw new NotFoundException('Proposal not found');
    }

    // Check ownership (artisan can delete their own proposals, admin can delete any)
    if (user.role !== UserRole.ADMIN) {
      this.ensureOwnerOrAdmin(user, existingProposal.artisanId);
    }

    // Prevent deletion if proposal is accepted
    if (existingProposal.status === ProposalStatus.ACCEPTED) {
      throw new BadRequestException('Cannot delete accepted proposal');
    }

    await this.prisma.proposal.delete({
      where: { id },
    });

    return { message: 'Proposal deleted successfully' };
  }

  private formatProposalResponse(proposal: any): ProposalResponseDto {
    return {
      id: proposal.id,
      jobId: proposal.jobId,
      message: proposal.message,
      amount: proposal.amount,
      status: proposal.status,
      createdAt: proposal.createdAt.toISOString(),
      updatedAt: proposal.updatedAt.toISOString(),
      job: proposal.job,
      client: proposal.client,
      artisan: proposal.artisan,
    };
  }
}
