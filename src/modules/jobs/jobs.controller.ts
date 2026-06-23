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
  UseInterceptors,
} from '@nestjs/common';
import { CacheInterceptor, CacheKey, CacheTTL } from '@nestjs/cache-manager';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiCreatedResponse,
  ApiNotFoundResponse,
  ApiForbiddenResponse,
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
import {
  CreateJobDto,
  UpdateJobDto,
  JobResponseDto,
  JobListQueryDto,
} from './dto/create-job.dto';
import { $Enums, JobStatus } from '../../generated/prisma';
import { JobsService } from './jobs.service';

@ApiTags('jobs')
@Controller('jobs')
export class JobsController {
  constructor(private readonly jobsService: JobsService) {}

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
  ): Promise<{ message: string; data: JobResponseDto }> {
    const job = await this.jobsService.createJob(user, createDto);
    return { message: 'Job created successfully', data: job };
  }

  @ApiOperation({ summary: 'List jobs with filtering and pagination' })
  @ApiOkResponse({ description: 'Jobs retrieved successfully.' })
  @ApiQuery({ name: 'status', required: false, enum: JobStatus })
  @ApiQuery({ name: 'clientId', required: false })
  @ApiQuery({ name: 'artisanId', required: false })
  @ApiQuery({ name: 'category', required: false })
  @ApiQuery({ name: 'search', required: false })
  @ApiQuery({ name: 'cursor', required: false, type: String })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @UseInterceptors(CacheInterceptor)
  @CacheTTL(60000)
  @Get()
  async listJobs(@Query() query: JobListQueryDto) {
    return this.jobsService.listJobs(query);
  }

  @ApiOperation({ summary: 'Get job by ID' })
  @ApiOkResponse({ description: 'Job retrieved successfully.' })
  @ApiNotFoundResponse({ description: 'Job not found.' })
  @ApiParam({ name: 'id', description: 'Job ID' })
  @Get(':id')
  async getJob(@Param('id') id: string): Promise<{ data: JobResponseDto }> {
    const job = await this.jobsService.getJob(id);
    return { data: job };
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
  ): Promise<{ message: string; data: JobResponseDto }> {
    const job = await this.jobsService.updateJob(user, id, updateDto);
    return { message: 'Job updated successfully', data: job };
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
    return this.jobsService.deleteJob(user, id);
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
  ): Promise<{ message: string; data: JobResponseDto }> {
    const job = await this.jobsService.assignArtisan(user, id, body.artisanId);
    return { message: 'Artisan assigned successfully', data: job };
  }
}
