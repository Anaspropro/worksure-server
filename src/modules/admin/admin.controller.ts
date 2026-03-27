import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../../common/constants/roles.constants';
import { RolesGuard } from '../../common/guards/roles.guard';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminResetPasswordDto } from './dto/admin-reset-password.dto';
import { ForceCloseJobDto } from './dto/force-close-job.dto';
import { ResolveDisputeDto } from './dto/resolve-dispute.dto';
import {
  AdminService,
  ReportType,
} from './admin.service';

@ApiTags('admin')
@ApiBearerAuth('bearer')
@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @ApiOperation({ summary: 'List all users' })
  @ApiOkResponse({ description: 'User list returned successfully.' })
  @Get('users')
  getAllUsers() {
    return this.adminService.getAllUsers();
  }

  @ApiOperation({ summary: 'Ban a user account' })
  @ApiParam({ name: 'id', description: 'User identifier' })
  @Patch('users/:id/ban')
  banUser(
    @Param('id') userId: string,
    @CurrentUser() adminUser: { sub: string; role: UserRole },
  ) {
    return this.adminService.banUser(userId, this.getActor(adminUser));
  }

  @ApiOperation({ summary: 'Unban a user account' })
  @ApiParam({ name: 'id', description: 'User identifier' })
  @Patch('users/:id/unban')
  unbanUser(
    @Param('id') userId: string,
    @CurrentUser() adminUser: { sub: string; role: UserRole },
  ) {
    return this.adminService.unbanUser(userId, this.getActor(adminUser));
  }

  @ApiOperation({ summary: 'Verify an artisan account' })
  @ApiParam({ name: 'id', description: 'User identifier' })
  @Patch('users/:id/verify')
  verifyArtisan(
    @Param('id') userId: string,
    @CurrentUser() adminUser: { sub: string; role: UserRole },
  ) {
    return this.adminService.verifyArtisan(userId, this.getActor(adminUser));
  }

  @ApiOperation({ summary: 'Issue a password reset token for a user' })
  @ApiParam({ name: 'id', description: 'User identifier' })
  @Patch('users/:id/reset-password')
  resetUserPassword(
    @Param('id') userId: string,
    @Body() body: AdminResetPasswordDto,
    @CurrentUser() adminUser: { sub: string; role: UserRole },
  ) {
    return this.adminService.resetUserPassword(
      userId,
      this.getActor(adminUser),
      body?.expiresInMinutes,
    );
  }

  @ApiOperation({ summary: 'List all disputes' })
  @Get('disputes')
  getAllDisputes() {
    return this.adminService.getAllDisputes();
  }

  @ApiOperation({ summary: 'Resolve a dispute' })
  @ApiParam({ name: 'id', description: 'Dispute identifier' })
  @Patch('disputes/:id/resolve')
  resolveDispute(
    @Param('id') disputeId: string,
    @Body() body: ResolveDisputeDto,
    @CurrentUser() adminUser: { sub: string; role: UserRole },
  ) {
    return this.adminService.resolveDispute(
      disputeId,
      body?.decision,
      this.getActor(adminUser),
      body?.notes,
    );
  }

  @ApiOperation({ summary: 'List jobs with an optional status filter' })
  @ApiQuery({ name: 'status', required: false, description: 'Job status filter' })
  @Get('jobs')
  getAllJobs(@Query('status') status?: string) {
    return this.adminService.getAllJobs(status);
  }

  @ApiOperation({ summary: 'Force-close a job' })
  @ApiParam({ name: 'id', description: 'Job identifier' })
  @Patch('jobs/:id/force-close')
  forceCloseJob(
    @Param('id') jobId: string,
    @Body() body: ForceCloseJobDto,
    @CurrentUser() adminUser: { sub: string; role: UserRole },
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
  @Get('transactions')
  getAllTransactions(@Query('type') type?: string) {
    return this.adminService.getAllTransactions(type);
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
  generateReports(
    @Query('reportType') reportType?: ReportType,
    @Query('month') month?: string,
  ) {
    return this.adminService.generateReports(reportType, month);
  }

  @ApiOperation({ summary: 'List audit logs' })
  @Get('audit-logs')
  getAuditLogs() {
    return this.adminService.getAuditLogs();
  }

  private getActor(adminUser: { sub: string; role: UserRole }) {
    return {
      id: adminUser.sub,
      role: adminUser.role,
    };
  }
}
