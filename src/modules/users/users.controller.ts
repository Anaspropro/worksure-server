import {
  Controller,
  Get,
  Patch,
  Param,
  Body,
  UseGuards,
  NotFoundException,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiNotFoundResponse,
  ApiForbiddenResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { UsersService } from './users.service';
import { UpdateUserProfileDto } from './dto/update-user-profile.dto';
import { $Enums } from '../../generated/prisma';
import { PrismaService } from '../../database/prisma.service';
import { UserRole } from '../../common/constants/roles.constants';

@ApiTags('users')
@Controller('users')
export class UsersController {
  constructor(
    private readonly usersService: UsersService,
    private readonly prisma: PrismaService,
  ) {}

  @ApiBearerAuth('bearer')
  @ApiOperation({ summary: 'Get current user profile' })
  @ApiOkResponse({ description: 'User profile returned successfully.' })
  @ApiNotFoundResponse({ description: 'User not found.' })
  @UseGuards(JwtAuthGuard)
  @Get('me')
  async getCurrentUser(
    @CurrentUser() user: { id: string; role: $Enums.UserRole },
  ) {
    const userWithProfile = await this.prisma.user.findUnique({
      where: { id: user.id },
      include: {
        artisanProfile: true,
      },
    });

    if (!userWithProfile) {
      throw new NotFoundException('User not found');
    }

    return this.usersService.sanitizeUser(userWithProfile);
  }

  @ApiBearerAuth('bearer')
  @ApiOperation({ summary: 'Update current user profile' })
  @ApiOkResponse({ description: 'User profile updated successfully.' })
  @ApiNotFoundResponse({ description: 'User not found.' })
  @UseGuards(JwtAuthGuard)
  @Patch('me')
  async updateCurrentUser(
    @CurrentUser() user: { id: string; role: $Enums.UserRole },
    @Body() updateDto: UpdateUserProfileDto,
  ) {
    const existingUser = await this.prisma.user.findUnique({
      where: { id: user.id },
    });

    if (!existingUser) {
      throw new NotFoundException('User not found');
    }

    const updatedUser = await this.prisma.user.update({
      where: { id: user.id },
      data: updateDto,
    });

    return this.usersService.sanitizeUser(updatedUser);
  }

  @ApiBearerAuth('bearer')
  @ApiOperation({ summary: 'Get user by ID (admin only)' })
  @ApiOkResponse({ description: 'User profile returned successfully.' })
  @ApiNotFoundResponse({ description: 'User not found.' })
  @ApiForbiddenResponse({ description: 'Admin access required.' })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @Get(':id')
  async getUserById(@Param('id') id: string) {
    const userWithProfile = await this.prisma.user.findUnique({
      where: { id },
      include: {
        artisanProfile: true,
      },
    });

    if (!userWithProfile) {
      throw new NotFoundException('User not found');
    }

    return this.usersService.sanitizeUser(userWithProfile);
  }
}
