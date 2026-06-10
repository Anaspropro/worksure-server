import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { UserRole } from '../../common/constants/roles.constants';
import { $Enums, ProposalStatus, JobStatus } from '../../generated/prisma';
import { v7 as uuidv7 } from 'uuid';
import {
  CreateProposalDto,
  UpdateProposalDto,
  ProposalResponseDto,
  ProposalListQueryDto,
} from './dto/create-proposal.dto';

@Injectable()
export class ProposalsService {
  constructor(private readonly prisma: PrismaService) {}

  private ensureArtisanRole(user: { role: $Enums.UserRole }) {
    if (user.role !== UserRole.ARTISAN) {
      throw new ForbiddenException('Artisan access required');
    }
  }

  private async ensureVerifiedArtisan(userId: string) {
    const artisan = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { artisanVerified: true, status: true },
    });

    if (!artisan) {
      throw new NotFoundException('Artisan account not found');
    }

    if (!artisan.artisanVerified) {
      throw new ForbiddenException(
        'Artisan verification is required before submitting proposals.',
      );
    }
  }

  private ensureOwnerOrAdmin(
    user: { id: string; role: $Enums.UserRole },
    proposalUserId: string,
  ) {
    const isOwner = user.id === proposalUserId;
    const isAdmin = user.role === UserRole.ADMIN;

    if (!isOwner && !isAdmin) {
      throw new ForbiddenException(
        'Access denied: You can only manage your own proposals',
      );
    }
  }

  private ensureJobOwnerOrAdmin(
    user: { id: string; role: $Enums.UserRole },
    jobClientId: string,
  ) {
    const isOwner = user.id === jobClientId;
    const isAdmin = user.role === UserRole.ADMIN;

    if (!isOwner && !isAdmin) {
      throw new ForbiddenException(
        'Access denied: You can only manage proposals for your own jobs',
      );
    }
  }

  async createProposal(
    user: { id: string; role: $Enums.UserRole },
    createDto: CreateProposalDto,
  ): Promise<ProposalResponseDto> {
    this.ensureArtisanRole(user);
    await this.ensureVerifiedArtisan(user.id);

    const job = await this.prisma.job.findUnique({
      where: { id: createDto.jobId },
    });

    if (!job) {
      throw new NotFoundException('Job not found');
    }

    if (job.status !== JobStatus.OPEN) {
      throw new BadRequestException(
        'Proposals can only be created for open jobs',
      );
    }

    if (job.clientId === user.id) {
      throw new BadRequestException(
        'You cannot submit a proposal to your own job.',
      );
    }

    const existingProposal = await this.prisma.proposal.findFirst({
      where: {
        jobId: createDto.jobId,
        artisanId: user.id,
        status: { notIn: [ProposalStatus.WITHDRAWN, ProposalStatus.REJECTED] },
      },
    });

    if (existingProposal) {
      throw new BadRequestException(
        'You already have an active proposal for this job',
      );
    }

    const proposal = await this.prisma.proposal.create({
      data: {
        id: uuidv7(),
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
        client: { select: { id: true, name: true, email: true } },
        artisan: { select: { id: true, name: true, email: true } },
      },
    });

    return this.formatProposalResponse(proposal);
  }

  async listProposals(query: ProposalListQueryDto) {
    const {
      page = 1,
      limit = 10,
      status,
      jobId,
      clientId,
      artisanId,
      search,
    } = query;
    const take = Math.min(limit, 100);
    const skip = (page - 1) * take;

    const where: any = {};
    if (status) where.status = status;
    if (jobId) where.jobId = jobId;
    if (clientId) where.clientId = clientId;
    if (artisanId) where.artisanId = artisanId;
    if (search) {
      where.OR = [
        { message: { contains: search, mode: 'insensitive' } },
        { job: { title: { contains: search, mode: 'insensitive' } } },
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
          client: { select: { id: true, name: true, email: true } },
          artisan: { select: { id: true, name: true, email: true } },
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.proposal.count({ where }),
    ]);

    const items = proposals.map((proposal) =>
      this.formatProposalResponse(proposal),
    );

    return {
      data: items,
      proposals: items,
      pagination: {
        page,
        limit: take,
        total,
        totalPages: Math.ceil(total / take),
        hasNext: page * take < total,
        hasPrev: page > 1,
      },
    };
  }

  async getProposal(id: string): Promise<ProposalResponseDto> {
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
        client: { select: { id: true, name: true, email: true } },
        artisan: { select: { id: true, name: true, email: true } },
      },
    });

    if (!proposal) {
      throw new NotFoundException('Proposal not found');
    }

    return this.formatProposalResponse(proposal);
  }

  async updateProposal(
    user: { id: string; role: $Enums.UserRole },
    id: string,
    updateDto: UpdateProposalDto,
  ): Promise<ProposalResponseDto> {
    const existingProposal = await this.prisma.proposal.findUnique({
      where: { id },
    });

    if (!existingProposal) {
      throw new NotFoundException('Proposal not found');
    }

    if (user.role !== UserRole.ADMIN) {
      this.ensureOwnerOrAdmin(user, existingProposal.artisanId);
    }

    if (
      existingProposal.status === ProposalStatus.ACCEPTED ||
      existingProposal.status === ProposalStatus.REJECTED
    ) {
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
        client: { select: { id: true, name: true, email: true } },
        artisan: { select: { id: true, name: true, email: true } },
      },
    });

    return this.formatProposalResponse(updatedProposal);
  }

  async withdrawProposal(
    user: { id: string; role: $Enums.UserRole },
    id: string,
  ): Promise<{ message: string }> {
    const existingProposal = await this.prisma.proposal.findUnique({
      where: { id },
    });

    if (!existingProposal) {
      throw new NotFoundException('Proposal not found');
    }

    if (user.role !== UserRole.ADMIN) {
      this.ensureOwnerOrAdmin(user, existingProposal.artisanId);
    }

    if (
      existingProposal.status === ProposalStatus.ACCEPTED ||
      existingProposal.status === ProposalStatus.REJECTED
    ) {
      throw new BadRequestException(
        'Cannot withdraw proposal in current status',
      );
    }

    await this.prisma.proposal.update({
      where: { id },
      data: { status: ProposalStatus.WITHDRAWN },
    });

    return { message: 'Proposal withdrawn successfully' };
  }

  async acceptProposal(
    user: { id: string; role: $Enums.UserRole },
    id: string,
  ): Promise<ProposalResponseDto> {
    const existingProposal = await this.prisma.proposal.findUnique({
      where: { id },
      include: { job: { select: { id: true, clientId: true, status: true } } },
    });

    if (!existingProposal) {
      throw new NotFoundException('Proposal not found');
    }

    if (user.role !== UserRole.ADMIN) {
      this.ensureJobOwnerOrAdmin(user, existingProposal.job.clientId);
    }

    if (existingProposal.status !== ProposalStatus.PENDING) {
      throw new BadRequestException('Can only accept pending proposals');
    }

    if (existingProposal.job?.status !== JobStatus.OPEN) {
      throw new BadRequestException(
        'Only proposals for open jobs can be accepted.',
      );
    }

    const updatedProposal = await this.prisma.proposal.update({
      where: { id },
      data: { status: ProposalStatus.ACCEPTED },
      include: {
        job: { select: { id: true, clientId: true, status: true } },
        client: { select: { id: true, name: true, email: true } },
        artisan: { select: { id: true, name: true, email: true } },
      },
    });

    return this.formatProposalResponse(updatedProposal);
  }

  async rejectProposal(
    user: { id: string; role: $Enums.UserRole },
    id: string,
  ): Promise<ProposalResponseDto> {
    const existingProposal = await this.prisma.proposal.findUnique({
      where: { id },
      include: { job: { select: { id: true, clientId: true, status: true } } },
    });

    if (!existingProposal) {
      throw new NotFoundException('Proposal system not found'); // Kept original error string 'Proposal system not found'
    }

    if (user.role !== UserRole.ADMIN) {
      this.ensureJobOwnerOrAdmin(user, existingProposal.job.clientId);
    }

    if (
      existingProposal.status === ProposalStatus.ACCEPTED ||
      existingProposal.status === ProposalStatus.REJECTED
    ) {
      throw new BadRequestException('Can only reject pending proposals');
    }

    const updatedProposal = await this.prisma.proposal.update({
      where: { id },
      data: { status: ProposalStatus.REJECTED },
      include: {
        job: { select: { id: true, clientId: true, status: true } },
        client: { select: { id: true, name: true, email: true } },
        artisan: { select: { id: true, name: true, email: true } },
      },
    });

    return this.formatProposalResponse(updatedProposal);
  }

  async deleteProposal(
    user: { id: string; role: $Enums.UserRole },
    id: string,
  ): Promise<{ message: string }> {
    const existingProposal = await this.prisma.proposal.findUnique({
      where: { id },
    });

    if (!existingProposal) {
      throw new NotFoundException('Proposal not found');
    }

    if (user.role !== UserRole.ADMIN) {
      this.ensureOwnerOrAdmin(user, existingProposal.artisanId);
    }

    if (existingProposal.status === ProposalStatus.ACCEPTED) {
      throw new BadRequestException('Cannot delete accepted proposal');
    }

    await this.prisma.proposal.delete({ where: { id } });

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
