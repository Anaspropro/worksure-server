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
import { DisputesService } from './disputes.service';
import { OpenDisputeDto } from './dto/open-dispute.dto';
import { SubmitEvidenceDto } from './dto/submit-evidence.dto';
import { $Enums, DisputeStatus, DisputeDecision } from '../../generated/prisma';

@ApiTags('disputes')
@Controller('disputes')
export class DisputesController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly disputesService: DisputesService,
  ) {}

  @ApiBearerAuth('bearer')
  @ApiOperation({ summary: 'Create a new dispute' })
  @ApiOkResponse({ description: 'Dispute created successfully.' })
  @ApiNotFoundResponse({ description: 'Contract not found.' })
  @ApiForbiddenResponse({ description: 'Access denied.' })
  @ApiBadRequestResponse({ description: 'Invalid dispute data.' })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Post('contract/:contractId')
  async createDispute(
    @CurrentUser() user: { id: string; role: $Enums.UserRole },
    @Param('contractId') contractId: string,
    @Body() dto: OpenDisputeDto,
  ) {
    const dispute = await this.disputesService.createDispute(
      user.id,
      dto.amountDisputed,
      dto.reason,
      dto.description,
      contractId
    );
    return dispute;
  }

  @ApiBearerAuth('bearer')
  @ApiOperation({ summary: 'Submit evidence for a dispute' })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Post(':id/evidence')
  async submitEvidence(
    @CurrentUser() user: { id: string; role: $Enums.UserRole },
    @Param('id') disputeId: string,
    @Body() dto: SubmitEvidenceDto,
  ) {
    return this.disputesService.submitEvidence(
      disputeId,
      user.id,
      dto.type,
      dto.url,
      dto.metadata
    );
  }

  @ApiBearerAuth('bearer')
  @ApiOperation({ summary: 'Change dispute state (Admin only)' })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @Patch(':id/state')
  async changeState(
    @CurrentUser() user: { id: string; role: $Enums.UserRole },
    @Param('id') disputeId: string,
    @Body('status') status: DisputeStatus,
    @Body('notes') notes?: string,
  ) {
    return this.disputesService.changeState(disputeId, status, user.id, notes);
  }

  @ApiBearerAuth('bearer')
  @ApiOperation({ summary: 'Resolve a dispute (Admin only)' })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @Patch(':id/resolve')
  async resolveDispute(
    @CurrentUser() user: { id: string; role: $Enums.UserRole },
    @Param('id') disputeId: string,
    @Body('decision') decision: DisputeDecision,
    @Body('notes') notes: string,
    @Body('split') split?: Record<string, number>,
  ) {
    return this.disputesService.resolveDispute(
      disputeId,
      decision,
      notes,
      user.id,
      split
    );
  }

  @ApiBearerAuth('bearer')
  @ApiOperation({ summary: 'List current user disputes' })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Get('me')
  async getMyDisputes(
    @CurrentUser() user: { id: string; role: $Enums.UserRole },
  ) {
    return this.disputesService.getDisputesByUser(user.id);
  }

  @ApiBearerAuth('bearer')
  @ApiOperation({ summary: 'Get dispute details by ID' })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Get(':id')
  async getDispute(
    @CurrentUser() user: { id: string; role: $Enums.UserRole },
    @Param('id') id: string,
  ) {
    return this.disputesService.getDisputeById(id, user.id, user.role);
  }
}
