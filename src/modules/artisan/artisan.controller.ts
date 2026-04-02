import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  UseGuards,
  NotFoundException,
  ForbiddenException,
  ConflictException,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiCreatedResponse,
  ApiNotFoundResponse,
  ApiForbiddenResponse,
  ApiConflictResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { $Enums } from '../../generated/prisma';
import { PrismaService } from '../../database/prisma.service';
import { UserRole } from '../../common/constants/roles.constants';
import { randomUUID } from 'node:crypto';
import {
  CreateArtisanProfileDto,
  UpdateArtisanProfileDto,
  ArtisanProfileResponseDto,
} from './dto/create-artisan-profile.dto';

@ApiTags('artisan')
@Controller('artisan')
export class ArtisanController {
  constructor(private readonly prisma: PrismaService) {}

  private ensureArtisanRole(user: { role: $Enums.UserRole }) {
    if (user.role !== $Enums.UserRole.ARTISAN) {
      throw new ForbiddenException('Artisan access required');
    }
  }

  @ApiBearerAuth('bearer')
  @ApiOperation({ summary: 'Create artisan profile' })
  @ApiCreatedResponse({ description: 'Artisan profile created successfully.' })
  @ApiForbiddenResponse({ description: 'Artisan access required.' })
  @ApiConflictResponse({ description: 'Artisan profile already exists.' })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ARTISAN)
  @Post('profile')
  async createArtisanProfile(
    @CurrentUser() user: { id: string; role: $Enums.UserRole },
    @Body() createDto: CreateArtisanProfileDto,
  ): Promise<ArtisanProfileResponseDto> {
    this.ensureArtisanRole(user);

    // Check if profile already exists
    const existingProfile = await this.prisma.artisanProfile.findUnique({
      where: { userId: user.id },
    });

    if (existingProfile) {
      throw new ConflictException('Artisan profile already exists');
    }

    const profile = await this.prisma.artisanProfile.create({
      data: {
        id: randomUUID(),
        userId: user.id,
        bio: createDto.bio || null,
        skills: JSON.stringify(createDto.skills || []),
        experience: createDto.experience || null,
        portfolio: JSON.stringify(createDto.portfolio || []),
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    return {
      ...profile,
      createdAt: profile.createdAt.toISOString(),
      updatedAt: profile.updatedAt.toISOString(),
    };
  }

  @ApiBearerAuth('bearer')
  @ApiOperation({ summary: 'Get current artisan profile' })
  @ApiOkResponse({ description: 'Artisan profile returned successfully.' })
  @ApiNotFoundResponse({ description: 'Artisan profile not found.' })
  @ApiForbiddenResponse({ description: 'Artisan access required.' })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ARTISAN)
  @Get('profile/me')
  async getCurrentArtisanProfile(
    @CurrentUser() user: { id: string; role: $Enums.UserRole },
  ): Promise<ArtisanProfileResponseDto> {
    this.ensureArtisanRole(user);

    const profile = await this.prisma.artisanProfile.findUnique({
      where: { userId: user.id },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    if (!profile) {
      throw new NotFoundException('Artisan profile not found');
    }

    return {
      ...profile,
      createdAt: profile.createdAt.toISOString(),
      updatedAt: profile.updatedAt.toISOString(),
    };
  }

  @ApiBearerAuth('bearer')
  @ApiOperation({ summary: 'Update artisan profile' })
  @ApiOkResponse({ description: 'Artisan profile updated successfully.' })
  @ApiNotFoundResponse({ description: 'Artisan profile not found.' })
  @ApiForbiddenResponse({ description: 'Artisan access required.' })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ARTISAN)
  @Patch('profile')
  async updateArtisanProfile(
    @CurrentUser() user: { id: string; role: $Enums.UserRole },
    @Body() updateDto: UpdateArtisanProfileDto,
  ): Promise<ArtisanProfileResponseDto> {
    this.ensureArtisanRole(user);

    const existingProfile = await this.prisma.artisanProfile.findUnique({
      where: { userId: user.id },
    });

    if (!existingProfile) {
      throw new NotFoundException('Artisan profile not found');
    }

    const updateData: any = {};
    if (updateDto.bio !== undefined) updateData.bio = updateDto.bio;
    if (updateDto.skills !== undefined)
      updateData.skills = JSON.stringify(updateDto.skills);
    if (updateDto.experience !== undefined)
      updateData.experience = updateDto.experience;
    if (updateDto.portfolio !== undefined)
      updateData.portfolio = JSON.stringify(updateDto.portfolio);

    const profile = await this.prisma.artisanProfile.update({
      where: { userId: user.id },
      data: updateData,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    return {
      ...profile,
      createdAt: profile.createdAt.toISOString(),
      updatedAt: profile.updatedAt.toISOString(),
    };
  }

  @ApiOperation({ summary: 'Get artisan profile by user ID' })
  @ApiOkResponse({ description: 'Artisan profile returned successfully.' })
  @ApiNotFoundResponse({ description: 'Artisan profile not found.' })
  @Get(':userId')
  async getArtisanProfileByUserId(
    @Param('userId') userId: string,
  ): Promise<ArtisanProfileResponseDto> {
    const profile = await this.prisma.artisanProfile.findUnique({
      where: { userId },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    if (!profile) {
      throw new NotFoundException('Artisan profile not found');
    }

    return {
      ...profile,
      createdAt: profile.createdAt.toISOString(),
      updatedAt: profile.updatedAt.toISOString(),
    };
  }
}
