import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Query,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { CacheInterceptor, CacheTTL } from '@nestjs/cache-manager';

import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { UserRole, AdminRole } from '../../generated/prisma';
import { AdminRolesGuard } from '../../common/guards/admin-roles.guard';
import { RequireAdminRole } from '../../common/decorators/admin-roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminResetPasswordDto } from './dto/admin-reset-password.dto';
import { ForceCloseJobDto } from './dto/force-close-job.dto';
import { ResolveDisputeDto } from './dto/resolve-dispute.dto';
import { RejectSuggestionDto } from './dto/reject-suggestion.dto';
import { ModerateReviewDto } from './dto/moderate-review.dto';
import { AdminService } from './admin.service';
import { AnalyticsService, ReportType } from '../analytics/analytics.service';
import { AuthenticatedUser } from '../auth/auth.service';

@ApiTags('admin')
@ApiBearerAuth('bearer')
@Controller('admin')
@UseGuards(JwtAuthGuard, AdminRolesGuard)
export class AdminController {
  constructor(
    private readonly adminService: AdminService,
    private readonly analyticsService: AnalyticsService,
  ) {}

  @ApiOperation({ summary: 'List all users' })
  @ApiOkResponse({ description: 'User list returned successfully.' })
  @UseInterceptors(CacheInterceptor)
  @CacheTTL(300000)
  @Get('users')
  @RequireAdminRole(AdminRole.OPERATIONS_MANAGER, AdminRole.SUPPORT_ADMIN)
  getAllUsers(
    @Query('search') search?: string,
    @Query('role') role?: UserRole,
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: string,
  ) {
    return this.adminService.getAllUsers(
      search,
      role,
      cursor,
      limit ? parseInt(limit, 10) : undefined,
    );
  }

  @ApiOperation({ summary: 'Get detailed admin view of a user' })
  @ApiOkResponse({ description: 'Detailed user view returned successfully.' })
  @ApiParam({ name: 'id', description: 'User identifier' })
  @Get('users/:id')
  @RequireAdminRole(AdminRole.OPERATIONS_MANAGER, AdminRole.SUPPORT_ADMIN)
  getUserDetail(@Param('id') userId: string) {
    return this.adminService.getUserDetail(userId);
  }

  @ApiOperation({ summary: 'Ban a user account' })
  @ApiParam({ name: 'id', description: 'User identifier' })
  @Patch('users/:id/ban')
  @RequireAdminRole(AdminRole.OPERATIONS_MANAGER)
  banUser(
    @Param('id') userId: string,
    @CurrentUser() adminUser: AuthenticatedUser,
  ) {
    return this.adminService.banUser(userId, this.getActor(adminUser));
  }

  @ApiOperation({ summary: 'Unban a user account' })
  @ApiParam({ name: 'id', description: 'User identifier' })
  @Patch('users/:id/unban')
  @RequireAdminRole(AdminRole.OPERATIONS_MANAGER)
  unbanUser(
    @Param('id') userId: string,
    @CurrentUser() adminUser: AuthenticatedUser,
  ) {
    return this.adminService.unbanUser(userId, this.getActor(adminUser));
  }

  @ApiOperation({ summary: 'Verify an artisan account' })
  @ApiParam({ name: 'id', description: 'User identifier' })
  @Patch('users/:id/verify')
  @RequireAdminRole(AdminRole.VERIFICATION_ADMIN)
  verifyArtisan(
    @Param('id') userId: string,
    @CurrentUser() adminUser: AuthenticatedUser,
  ) {
    return this.adminService.verifyArtisan(userId, this.getActor(adminUser));
  }

  @ApiOperation({ summary: 'Reject an artisan account verification' })
  @ApiParam({ name: 'id', description: 'User identifier' })
  @Patch('users/:id/reject-verification')
  @RequireAdminRole(AdminRole.VERIFICATION_ADMIN)
  rejectArtisanVerification(
    @Param('id') userId: string,
    @CurrentUser() adminUser: AuthenticatedUser,
  ) {
    return this.adminService.rejectArtisanVerification(userId, this.getActor(adminUser));
  }

  @ApiOperation({ summary: 'Issue a password reset token for a user' })
  @ApiParam({ name: 'id', description: 'User identifier' })
  @Patch('users/:id/reset-password')
  @RequireAdminRole(AdminRole.OPERATIONS_MANAGER, AdminRole.SUPPORT_ADMIN)
  resetUserPassword(
    @Param('id') userId: string,
    @Body() body: AdminResetPasswordDto,
    @CurrentUser() adminUser: AuthenticatedUser,
  ) {
    return this.adminService.resetUserPassword(
      userId,
      this.getActor(adminUser),
      body?.expiresInMinutes,
    );
  }

  @ApiOperation({ summary: 'List all disputes' })
  @UseInterceptors(CacheInterceptor)
  @CacheTTL(300000)
  @Get('disputes')
  @RequireAdminRole(AdminRole.DISPUTE_ADMIN)
  getAllDisputes(
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: string,
  ) {
    return this.adminService.getAllDisputes(
      cursor,
      limit ? parseInt(limit, 10) : undefined,
    );
  }

  @ApiOperation({ summary: 'Resolve a dispute' })
  @ApiParam({ name: 'id', description: 'Dispute identifier' })
  @Patch('disputes/:id/resolve')
  @RequireAdminRole(AdminRole.DISPUTE_ADMIN)
  resolveDispute(
    @Param('id') disputeId: string,
    @Body() body: ResolveDisputeDto,
    @CurrentUser() adminUser: AuthenticatedUser,
  ) {
    return this.adminService.resolveDispute(
      disputeId,
      body?.decision,
      this.getActor(adminUser),
      body?.notes,
    );
  }

  @ApiOperation({ summary: 'List jobs with an optional status filter' })
  @ApiQuery({
    name: 'status',
    required: false,
    description: 'Job status filter',
  })
  @Get('jobs')
  @RequireAdminRole(AdminRole.OPERATIONS_MANAGER, AdminRole.SUPPORT_ADMIN)
  getAllJobs(
    @Query('search') search?: string,
    @Query('status') status?: string,
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: string,
  ) {
    return this.adminService.getAllJobs(
      search,
      status,
      cursor,
      limit ? parseInt(limit, 10) : undefined,
    );
  }

  @ApiOperation({ summary: 'Force-close a job' })
  @ApiParam({ name: 'id', description: 'Job identifier' })
  @Patch('jobs/:id/force-close')
  @RequireAdminRole(AdminRole.OPERATIONS_MANAGER)
  forceCloseJob(
    @Param('id') jobId: string,
    @Body() body: ForceCloseJobDto,
    @CurrentUser() adminUser: AuthenticatedUser,
  ) {
    return this.adminService.forceCloseJob(
      jobId,
      this.getActor(adminUser),
      body?.reason,
    );
  }

  @ApiOperation({
    summary: 'List transactions with an optional transaction type filter',
  })
  @ApiQuery({
    name: 'type',
    required: false,
    description: 'Transaction type filter',
  })
  @UseInterceptors(CacheInterceptor)
  @CacheTTL(300000)
  @Get('transactions')
  @RequireAdminRole(AdminRole.FINANCE_ADMIN)
  getAllTransactions(
    @Query('type') type?: string,
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: string,
  ) {
    return this.adminService.getAllTransactions(
      type,
      cursor,
      limit ? parseInt(limit, 10) : undefined,
    );
  }

  @ApiOperation({ summary: 'Generate admin reports' })
  @ApiQuery({
    name: 'reportType',
    required: false,
    description: 'Report type to generate',
  })
  @ApiQuery({
    name: 'month',
    required: false,
    description: 'Optional YYYY-MM month selector',
  })
  @Get('reports')
  @RequireAdminRole(AdminRole.ANALYTICS_ADMIN)
  generateReports(
    @Query('reportType') reportType?: ReportType,
    @Query('month') month?: string,
    @Query('force') force?: boolean,
  ) {
    return this.analyticsService.generateReports(reportType, month, force);
  }

  @ApiOperation({ summary: 'List audit logs' })
  @UseInterceptors(CacheInterceptor)
  @CacheTTL(300000)
  @Get('audit-logs')
  @RequireAdminRole(AdminRole.OPERATIONS_MANAGER)
  getAuditLogs(
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: string,
  ) {
    return this.adminService.getAuditLogs(
      cursor,
      limit ? parseInt(limit, 10) : undefined,
    );
  }

  @ApiOperation({ summary: 'List all system contracts' })
  @ApiQuery({
    name: 'status',
    required: false,
    description: 'Contract status filter',
  })
  @UseInterceptors(CacheInterceptor)
  @CacheTTL(300000)
  @Get('contracts')
  @RequireAdminRole(AdminRole.OPERATIONS_MANAGER, AdminRole.SUPPORT_ADMIN, AdminRole.DISPUTE_ADMIN)
  getAllContracts(
    @Query('search') search?: string,
    @Query('status') status?: string,
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: string,
  ) {
    return this.adminService.getAllContracts(
      search,
      status,
      cursor,
      limit ? parseInt(limit, 10) : undefined,
    );
  }

  @ApiOperation({ summary: 'List all reviews' })
  @ApiQuery({
    name: 'status',
    required: false,
    description: 'Review status filter',
  })
  @Get('reviews')
  @RequireAdminRole(
    AdminRole.OPERATIONS_MANAGER,
    AdminRole.SUPPORT_ADMIN,
    AdminRole.DISPUTE_ADMIN,
  )
  getAllReviews(
    @Query('search') search?: string,
    @Query('status') status?: string,
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: string,
  ) {
    return this.adminService.getAllReviews(
      search,
      status,
      cursor,
      limit ? parseInt(limit, 10) : undefined,
    );
  }

  @ApiOperation({ summary: 'Moderate a review' })
  @ApiParam({ name: 'id', description: 'Review identifier' })
  @Patch('reviews/:id/moderate')
  @RequireAdminRole(AdminRole.OPERATIONS_MANAGER, AdminRole.DISPUTE_ADMIN)
  moderateReview(
    @Param('id') reviewId: string,
    @Body() body: ModerateReviewDto,
    @CurrentUser() adminUser: AuthenticatedUser,
  ) {
    return this.adminService.moderateReview(
      reviewId,
      body.action,
      this.getActor(adminUser),
      body.reason,
    );
  }

  @ApiOperation({ summary: 'Get system contract statistics' })
  @Get('contracts/stats')
  @RequireAdminRole(AdminRole.OPERATIONS_MANAGER, AdminRole.ANALYTICS_ADMIN)
  getContractStats() {
    return this.analyticsService.getContractStats();
  }


  @ApiOperation({ summary: 'List all system configurations' })
  @Get('config')
  @RequireAdminRole(AdminRole.SUPER_ADMIN, AdminRole.OPERATIONS_MANAGER)
  getSystemConfig() {
    return this.adminService.getSystemConfig();
  }

  @ApiOperation({ summary: 'Update a system configuration' })
  @ApiParam({ name: 'key', description: 'Configuration key' })
  @Patch('config/:key')
  @RequireAdminRole(AdminRole.SUPER_ADMIN, AdminRole.OPERATIONS_MANAGER)
  updateSystemConfig(
    @Param('key') key: string,
    @Body() body: { value: any; description?: string },
    @CurrentUser() adminUser: AuthenticatedUser,
  ) {
    return this.adminService.updateSystemConfig(
      key,
      body.value,
      this.getActor(adminUser),
      body.description,
    );
  }

  private getActor(adminUser: AuthenticatedUser) {
    return {
      id: adminUser.id,
      role: adminUser.role,
    };
  }
}

