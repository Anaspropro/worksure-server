import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { UserRole } from '../../common/constants/roles.constants';
import { $Enums, JobStatus } from '../../generated/prisma';
import { randomUUID } from 'node:crypto';
import {
  CreateJobDto,
  UpdateJobDto,
  JobListQueryDto,
  JobResponseDto,
} from './dto/create-job.dto';

@Injectable()
export class JobsService {
  constructor(private readonly prisma: PrismaService) {}

  private ensureClientRole(user: { role: $Enums.UserRole }) {
    if (user.role !== UserRole.CLIENT) {
      throw new ForbiddenException('Client access required');
    }
  }

  private ensureOwnerOrAdmin(
    user: { id: string; role: $Enums.UserRole },
    jobClientId: string,
  ) {
    const isOwner = user.id === jobClientId;
    const isAdmin = user.role === UserRole.ADMIN;

    if (!isOwner && !isAdmin) {
      throw new ForbiddenException(
        'Access denied: You can only manage your own jobs',
      );
    }
  }

  async createJob(
    user: { id: string; role: $Enums.UserRole },
    createDto: CreateJobDto,
  ): Promise<JobResponseDto> {
    this.ensureClientRole(user);

    const job = await this.prisma.job.create({
      data: {
        id: randomUUID(),
        clientId: user.id,
        title: createDto.title,
        description: createDto.description,
        budget: createDto.budget,
        location: createDto.location || null,
        requiredSkills: createDto.requiredSkills
          ? createDto.requiredSkills
          : undefined,
        category: createDto.category,
        deadline: createDto.deadline ? new Date(createDto.deadline) : null,
        requirements: createDto.requirements,
        status: JobStatus.OPEN,
      },
      include: {
        client: { select: { id: true, name: true, email: true } },
        artisan: { select: { id: true, name: true, email: true } },
        contract: { select: { id: true, status: true, amount: true } },
      },
    });

    return this.formatJobResponse(job);
  }

  async listJobs(query: JobListQueryDto) {
    const {
      page = 1,
      limit = 10,
      status,
      clientId,
      artisanId,
      category,
      search,
    } = query;
    const skip = (page - 1) * limit;
    const take = Math.min(limit, 100);

    const where: any = {};
    if (status) where.status = status;
    if (clientId) where.clientId = clientId;
    if (artisanId) where.artisanId = artisanId;
    if (category) where.category = category;
    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
        { requirements: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [jobs, total] = await Promise.all([
      this.prisma.job.findMany({
        where,
        skip,
        take,
        include: {
          client: { select: { id: true, name: true, email: true } },
          artisan: { select: { id: true, name: true, email: true } },
          contract: { select: { id: true, status: true, amount: true } },
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.job.count({ where }),
    ]);

    return {
      jobs: jobs.map((job) => this.formatJobResponse(job)),
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

  async getJob(id: string): Promise<JobResponseDto> {
    const job = await this.prisma.job.findUnique({
      where: { id },
      include: {
        client: { select: { id: true, name: true, email: true } },
        artisan: { select: { id: true, name: true, email: true } },
        contract: { select: { id: true, status: true, amount: true } },
      },
    });

    if (!job) {
      throw new NotFoundException('Job not found');
    }

    return this.formatJobResponse(job);
  }

  async updateJob(
    user: { id: string; role: $Enums.UserRole },
    id: string,
    updateDto: UpdateJobDto,
  ): Promise<JobResponseDto> {
    const existingJob = await this.prisma.job.findUnique({ where: { id } });

    if (!existingJob) {
      throw new NotFoundException('Job not found');
    }

    if (user.role !== UserRole.ADMIN) {
      this.ensureOwnerOrAdmin(user, existingJob.clientId);
    }

    const updateData: any = {};
    if (updateDto.title !== undefined) updateData.title = updateDto.title;
    if (updateDto.description !== undefined)
      updateData.description = updateDto.description;
    if (updateDto.budget !== undefined) updateData.budget = updateDto.budget;
    if (updateDto.location !== undefined)
      updateData.location = updateDto.location;
    if (updateDto.requiredSkills !== undefined)
      updateData.requiredSkills = updateDto.requiredSkills;
    if (updateDto.category !== undefined)
      updateData.category = updateDto.category;
    if (updateDto.deadline !== undefined)
      updateData.deadline = new Date(updateDto.deadline);
    if (updateDto.status !== undefined) updateData.status = updateDto.status;
    if (updateDto.requirements !== undefined)
      updateData.requirements = updateDto.requirements;

    const updatedJob = await this.prisma.job.update({
      where: { id },
      data: updateData,
      include: {
        client: { select: { id: true, name: true, email: true } },
        artisan: { select: { id: true, name: true, email: true } },
        contract: { select: { id: true, status: true, amount: true } },
      },
    });

    return this.formatJobResponse(updatedJob);
  }

  async deleteJob(
    user: { id: string; role: $Enums.UserRole },
    id: string,
  ): Promise<{ message: string }> {
    const existingJob = await this.prisma.job.findUnique({ where: { id } });

    if (!existingJob) {
      throw new NotFoundException('Job not found');
    }

    if (user.role !== UserRole.ADMIN) {
      this.ensureOwnerOrAdmin(user, existingJob.clientId);
    }

    if (existingJob.contractId) {
      throw new BadRequestException('Cannot delete job with active contract');
    }

    await this.prisma.job.delete({ where: { id } });

    return { message: 'Job deleted successfully' };
  }

  async assignArtisan(
    user: { id: string; role: $Enums.UserRole },
    id: string,
    artisanId: string,
  ): Promise<JobResponseDto> {
    const existingJob = await this.prisma.job.findUnique({ where: { id } });

    if (!existingJob) {
      throw new NotFoundException('Job not found');
    }

    if (user.role !== UserRole.ADMIN) {
      this.ensureOwnerOrAdmin(user, existingJob.clientId);
    }

    const artisan = await this.prisma.user.findUnique({
      where: { id: artisanId },
    });

    if (!artisan || artisan.role !== $Enums.UserRole.ARTISAN) {
      throw new BadRequestException('Invalid artisan ID');
    }

    const updatedJob = await this.prisma.job.update({
      where: { id },
      data: { artisanId, status: JobStatus.IN_PROGRESS },
      include: {
        client: { select: { id: true, name: true, email: true } },
        artisan: { select: { id: true, name: true, email: true } },
        contract: { select: { id: true, status: true, amount: true } },
      },
    });

    return this.formatJobResponse(updatedJob);
  }

  private formatJobResponse(job: any): JobResponseDto {
    return {
      id: job.id,
      title: job.title,
      description: job.description,
      budget: job.budget,
      location: job.location,
      requiredSkills: job.requiredSkills
        ? JSON.parse(job.requiredSkills as string)
        : [],
      category: job.category,
      deadline: job.deadline?.toISOString() || null,
      requirements: job.requirements,
      status: job.status,
      client: job.client,
      artisan: job.artisan || null,
      contract: job.contract || null,
      createdAt: job.createdAt.toISOString(),
      updatedAt: job.updatedAt.toISOString(),
    };
  }
}
