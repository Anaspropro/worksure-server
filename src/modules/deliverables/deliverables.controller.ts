import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Put,
  UseGuards,
} from '@nestjs/common';
import { DeliverablesService } from './deliverables.service';
import { SubmitDeliverableVersionDto } from './dto/submit-version.dto';
import { RequestRevisionDto } from './dto/request-revision.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { UserRole } from '../../common/constants/roles.constants';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';

@ApiTags('Deliverables')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('deliverables')
export class DeliverablesController {
  constructor(private readonly deliverablesService: DeliverablesService) {}

  @Get('contract/:contractId')
  @ApiOperation({ summary: 'Get the active deliverable for a contract' })
  getDeliverableForContract(@Param('contractId') contractId: string) {
    return this.deliverablesService.getDeliverableForContract(contractId);
  }

  @Post('contract/:contractId/submit')
  @Roles(UserRole.ARTISAN)
  @ApiOperation({
    summary: 'Submit a new version of the deliverable (Artisan only)',
  })
  submitVersion(
    @Param('contractId') contractId: string,
    @Body() dto: SubmitDeliverableVersionDto,
    @CurrentUser() user: any,
  ) {
    return this.deliverablesService.submitVersion(contractId, user.id, dto);
  }

  @Put(':id/view')
  @Roles(UserRole.CLIENT)
  @ApiOperation({ summary: 'Mark deliverable as viewed by client' })
  markAsViewed(@Param('id') id: string, @CurrentUser() user: any) {
    return this.deliverablesService.markAsViewed(id, user.id);
  }

  @Post(':id/request-revision')
  @Roles(UserRole.CLIENT)
  @ApiOperation({ summary: 'Request a revision (Client only)' })
  requestRevision(
    @Param('id') id: string,
    @Body() dto: RequestRevisionDto,
    @CurrentUser() user: any,
  ) {
    return this.deliverablesService.requestRevision(id, user.id, dto);
  }

  @Post(':id/approve')
  @Roles(UserRole.CLIENT)
  @ApiOperation({ summary: 'Approve a deliverable (Client only)' })
  approveDeliverable(@Param('id') id: string, @CurrentUser() user: any) {
    return this.deliverablesService.approve(id, user.id);
  }
}
