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
  CreateJobDto,
  UpdateJobDto,
  JobResponseDto,
  JobListQueryDto,
} from './dto/create-job.dto';
import { $Enums, JobStatus } from '../../generated/prisma';

@ApiTags('jobs')
@Controller('jobs')
export class JobsController {
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
      throw new ForbiddenException('Access denied: You can only manage your own jobs');
    }
  }

  @ApiBearerAuth('bearer')
  @ApiOperation({ summary: 'Create a new job' })
  @ApiCreatedResponse({ description: 'Job created successfully.' })
  @ApiForbiddenResponse({ description: 'Client access required.' })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.CLIENT)
  @Post()
  async createJob(
    @CurrentUser() user: { id: string; role: $Enums.UserRole },
    @Body() createDto: CreateJobDto,
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
        requiredSkills: createDto.requiredSkills ? createDto.requiredSkills : undefined,
        category: createDto.category,
        deadline: createDto.deadline ? new Date(createDto.deadline) : null,
        requirements: createDto.requirements,
        status: JobStatus.OPEN,
      },
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
        contract: {
          select: {
            id: true,
            status: true,
            amount: true,
          },
        },
      },
    });

    return this.formatJobResponse(job);
  }

  @ApiOperation({ summary: 'List jobs with filtering and pagination' })
  @ApiOkResponse({ description: 'Jobs retrieved successfully.' })
  @ApiQuery({ name: 'status', required: false, enum: JobStatus })
  @ApiQuery({ name: 'clientId', required: false })
  @ApiQuery({ name: 'artisanId', required: false })
  @ApiQuery({ name: 'category', required: false })
  @ApiQuery({ name: 'search', required: false })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @Get()
  async listJobs(@Query() query: JobListQueryDto) {
    const { page = 1, limit = 10, status, clientId, artisanId, category, search } = query;
    
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
          contract: {
            select: {
              id: true,
              status: true,
              amount: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.job.count({ where }),
    ]);

    return {
      jobs: jobs.map(job => this.formatJobResponse(job)),
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

  @ApiOperation({ summary: 'Get job by ID' })
  @ApiOkResponse({ description: 'Job retrieved successfully.' })
  @ApiNotFoundResponse({ description: 'Job not found.' })
  @ApiParam({ name: 'id', description: 'Job ID' })
  @Get(':id')
  async getJob(@Param('id') id: string) {
    const job = await this.prisma.job.findUnique({
      where: { id },
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
        contract: {
          select: {
            id: true,
            status: true,
            amount: true,
          },
        },
      },
    });

    if (!job) {
      throw new NotFoundException('Job not found');
    }

    return this.formatJobResponse(job);
  }

  @ApiBearerAuth('bearer')
  @ApiOperation({ summary: 'Update job' })
  @ApiOkResponse({ description: 'Job updated successfully.' })
  @ApiNotFoundResponse({ description: 'Job not found.' })
  @ApiForbiddenResponse({ description: 'Access denied.' })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.CLIENT, UserRole.ADMIN)
  @Patch(':id')
  async updateJob(
    @CurrentUser() user: { id: string; role: $Enums.UserRole },
    @Param('id') id: string,
    @Body() updateDto: UpdateJobDto,
  ): Promise<JobResponseDto> {
    const existingJob = await this.prisma.job.findUnique({
      where: { id },
    });

    if (!existingJob) {
      throw new NotFoundException('Job not found');
    }

    // Check ownership (unless admin)
    if (user.role !== UserRole.ADMIN) {
      this.ensureOwnerOrAdmin(user, existingJob.clientId);
    }

    const updateData: any = {};
    if (updateDto.title !== undefined) updateData.title = updateDto.title;
    if (updateDto.description !== undefined) updateData.description = updateDto.description;
    if (updateDto.budget !== undefined) updateData.budget = updateDto.budget;
    if (updateDto.location !== undefined) updateData.location = updateDto.location;
    if (updateDto.requiredSkills !== undefined) updateData.requiredSkills = updateDto.requiredSkills;
    if (updateDto.category !== undefined) updateData.category = updateDto.category;
    if (updateDto.deadline !== undefined) updateData.deadline = new Date(updateDto.deadline);
    if (updateDto.status !== undefined) updateData.status = updateDto.status;
    if (updateDto.requirements !== undefined) updateData.requirements = updateDto.requirements;

    const updatedJob = await this.prisma.job.update({
      where: { id },
      data: updateData,
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
        contract: {
          select: {
            id: true,
            status: true,
            amount: true,
          },
        },
      },
    });

    return this.formatJobResponse(updatedJob);
  }

  @ApiBearerAuth('bearer')
  @ApiOperation({ summary: 'Delete job' })
  @ApiOkResponse({ description: 'Job deleted successfully.' })
  @ApiNotFoundResponse({ description: 'Job not found.' })
  @ApiForbiddenResponse({ description: 'Access denied.' })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.CLIENT, UserRole.ADMIN)
  @Delete(':id')
  async deleteJob(
    @CurrentUser() user: { id: string; role: $Enums.UserRole },
    @Param('id') id: string,
  ): Promise<{ message: string }> {
    const existingJob = await this.prisma.job.findUnique({
      where: { id },
    });

    if (!existingJob) {
      throw new NotFoundException('Job not found');
    }

    // Check ownership (unless admin)
    if (user.role !== UserRole.ADMIN) {
      this.ensureOwnerOrAdmin(user, existingJob.clientId);
    }

    // Prevent deletion if job has active contract
    if (existingJob.contractId) {
      throw new BadRequestException('Cannot delete job with active contract');
    }

    await this.prisma.job.delete({
      where: { id },
    });

    return { message: 'Job deleted successfully' };
  }

  @ApiBearerAuth('bearer')
  @ApiOperation({ summary: 'Assign artisan to job' })
  @ApiOkResponse({ description: 'Artisan assigned successfully.' })
  @ApiNotFoundResponse({ description: 'Job not found.' })
  @ApiForbiddenResponse({ description: 'Access denied.' })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.CLIENT, UserRole.ADMIN)
  @Patch(':id/assign')
  async assignArtisan(
    @CurrentUser() user: { id: string; role: $Enums.UserRole },
    @Param('id') id: string,
    @Body() body: { artisanId: string },
  ): Promise<JobResponseDto> {
    const existingJob = await this.prisma.job.findUnique({
      where: { id },
    });

    if (!existingJob) {
      throw new NotFoundException('Job not found');
    }

    // Check ownership (unless admin)
    if (user.role !== UserRole.ADMIN) {
      this.ensureOwnerOrAdmin(user, existingJob.clientId);
    }

    // Check if artisan exists and has ARTISAN role
    const artisan = await this.prisma.user.findUnique({
      where: { id: body.artisanId },
    });

    if (!artisan || artisan.role !== $Enums.UserRole.ARTISAN) {
      throw new BadRequestException('Invalid artisan ID');
    }

    const updatedJob = await this.prisma.job.update({
      where: { id },
      data: {
        artisanId: body.artisanId,
        status: JobStatus.IN_PROGRESS,
      },
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
        contract: {
          select: {
            id: true,
            status: true,
            amount: true,
          },
        },
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
      requiredSkills: job.requiredSkills ? JSON.parse(job.requiredSkills as string) : [],
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
