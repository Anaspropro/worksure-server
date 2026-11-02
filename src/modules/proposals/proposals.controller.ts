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
} from '@nestjs/common';
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
  CreateProposalDto,
  UpdateProposalDto,
  ProposalResponseDto,
  ProposalListQueryDto,
  ProposalActionDto,
  ProposalComparisonItemDto,
} from './dto/create-proposal.dto';
import { $Enums, ProposalStatus } from '../../generated/prisma';
import { ProposalsService } from './proposals.service';

@ApiTags('proposals')
@Controller('proposals')
export class ProposalsController {
  constructor(private readonly proposalsService: ProposalsService) {}

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
    return this.proposalsService.createProposal(user, createDto);
  }

  @ApiOperation({ summary: 'List proposals with filtering and pagination' })
  @ApiOkResponse({
    description: 'Proposals retrieved successfully.',
    type: [ProposalResponseDto],
  })
  @ApiQuery({ name: 'status', required: false, enum: ProposalStatus })
  @ApiQuery({ name: 'jobId', required: false })
  @ApiQuery({ name: 'clientId', required: false })
  @ApiQuery({ name: 'artisanId', required: false })
  @ApiQuery({ name: 'search', required: false })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @Get()
  async listProposals(@Query() query: ProposalListQueryDto) {
    return this.proposalsService.listProposals(query);
  }

  @ApiBearerAuth('bearer')
  @ApiOperation({ summary: 'Get proposal by ID' })
  @ApiOkResponse({
    description: 'Proposal retrieved successfully.',
    type: ProposalResponseDto,
  })
  @ApiNotFoundResponse({ description: 'Proposal not found.' })
  @ApiForbiddenResponse({ description: 'Access denied.' })
  @ApiParam({ name: 'id', description: 'Proposal ID' })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Get(':id')
  async getProposal(
    @CurrentUser() user: { id: string; role: $Enums.UserRole },
    @Param('id') id: string,
  ) {
    return this.proposalsService.getProposal(user, id);
  }

  @ApiBearerAuth('bearer')
  @ApiOperation({ summary: 'Compare proposals for a job' })
  @ApiOkResponse({
    description: 'Proposals compared successfully.',
    type: [ProposalComparisonItemDto],
  })
  @ApiNotFoundResponse({ description: 'Job not found.' })
  @ApiForbiddenResponse({ description: 'Access denied.' })
  @ApiParam({ name: 'jobId', description: 'Job ID' })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Get('job/:jobId/compare')
  async compareProposals(
    @CurrentUser() user: { id: string; role: $Enums.UserRole },
    @Param('jobId') jobId: string,
  ) {
    return this.proposalsService.compareProposals(user, jobId);
  }

  @ApiBearerAuth('bearer')
  @ApiOperation({ summary: 'Update proposal' })
  @ApiOkResponse({
    description: 'Proposal updated successfully.',
    type: ProposalResponseDto,
  })
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
    return this.proposalsService.updateProposal(user, id, updateDto);
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
    return this.proposalsService.withdrawProposal(user, id);
  }

  @ApiBearerAuth('bearer')
  @ApiOperation({ summary: 'Accept proposal' })
  @ApiOkResponse({
    description: 'Proposal accepted successfully.',
    type: ProposalResponseDto,
  })
  @ApiNotFoundResponse({ description: 'Proposal not found.' })
  @ApiForbiddenResponse({ description: 'Access denied.' })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.CLIENT, UserRole.ADMIN)
  @Patch(':id/accept')
  async acceptProposal(
    @CurrentUser() user: { id: string; role: $Enums.UserRole },
    @Param('id') id: string,
  ): Promise<ProposalResponseDto> {
    return this.proposalsService.acceptProposal(user, id);
  }

  @ApiBearerAuth('bearer')
  @ApiOperation({ summary: 'Reject proposal' })
  @ApiOkResponse({
    description: 'Proposal rejected successfully.',
    type: ProposalResponseDto,
  })
  @ApiNotFoundResponse({ description: 'Proposal not found.' })
  @ApiForbiddenResponse({ description: 'Access denied.' })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.CLIENT, UserRole.ADMIN)
  @Patch(':id/reject')
  async rejectProposal(
    @CurrentUser() user: { id: string; role: $Enums.UserRole },
    @Param('id') id: string,
    @Body() _body: ProposalActionDto,
  ): Promise<ProposalResponseDto> {
    return this.proposalsService.rejectProposal(user, id);
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
    return this.proposalsService.deleteProposal(user, id);
  }
}
