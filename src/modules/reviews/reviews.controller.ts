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
  BadRequestException,
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
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { UserRole } from '../../common/constants/roles.constants';
import { PrismaService } from '../../database/prisma.service';
import { randomUUID } from 'node:crypto';
import {
  CreateReviewDto,
  UpdateReviewDto,
  ReviewResponseDto,
  ReviewListQueryDto,
  ReviewStatsDto,
} from './dto/review.dto';
import { $Enums, ContractStatus } from '../../generated/prisma';

@ApiTags('reviews')
@Controller('reviews')
export class ReviewsController {
  constructor(private readonly prisma: PrismaService) {}

  private ensureReviewParticipantOrAdmin(
    user: { id: string; role: $Enums.UserRole },
    clientId: string,
    artisanId: string,
  ) {
    const isClient = user.id === clientId;
    const isArtisan = user.id === artisanId;
    const isAdmin = user.role === UserRole.ADMIN;

    if (!isClient && !isArtisan && !isAdmin) {
      throw new ForbiddenException(
        'Access denied: You can only manage reviews you participate in',
      );
    }
  }

  @ApiBearerAuth('bearer')
  @ApiOperation({ summary: 'Create a new review' })
  @ApiOkResponse({ description: 'Review created successfully.' })
  @ApiNotFoundResponse({ description: 'Contract not found.' })
  @ApiForbiddenResponse({
    description: 'Access denied or not eligible to review.',
  })
  @ApiBadRequestResponse({
    description: 'Invalid review data or contract not completed.',
  })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Post()
  async createReview(
    @CurrentUser() user: { id: string; role: $Enums.UserRole },
    @Body() createDto: CreateReviewDto,
  ): Promise<ReviewResponseDto> {
    const contract = await this.prisma.contract.findUnique({
      where: { id: createDto.contractId },
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
        job: {
          select: {
            title: true,
          },
        },
      },
    });

    if (!contract) {
      throw new NotFoundException('Contract not found');
    }

    // Check if user is the client (only clients can create reviews)
    if (user.role !== UserRole.ADMIN && contract.clientId !== user.id) {
      throw new ForbiddenException('Only clients can create reviews');
    }

    // Check if contract is completed
    if (contract.status !== ContractStatus.COMPLETED) {
      throw new BadRequestException('You can only review completed contracts');
    }

    // Check if review already exists for this contract
    const existingReview = await this.prisma.review.findFirst({
      where: {
        contractId: createDto.contractId,
        clientId: user.id,
      },
    });

    if (existingReview) {
      throw new BadRequestException('You have already reviewed this contract');
    }

    // Create review
    const review = await this.prisma.review.create({
      data: {
        id: randomUUID(),
        contractId: createDto.contractId,
        clientId: user.id,
        artisanId: contract.artisanId,
        rating: createDto.rating,
        comment: createDto.comment,
        createdAt: new Date(),
      },
    });

    return this.formatReviewResponse(review, contract);
  }

  @ApiBearerAuth('bearer')
  @ApiOperation({ summary: 'List reviews with filtering' })
  @ApiOkResponse({ description: 'Reviews retrieved successfully.' })
  @ApiForbiddenResponse({ description: 'Authentication required.' })
  @ApiQuery({ name: 'contractId', required: false })
  @ApiQuery({ name: 'clientId', required: false })
  @ApiQuery({ name: 'artisanId', required: false })
  @ApiQuery({ name: 'minRating', required: false, type: Number })
  @ApiQuery({ name: 'maxRating', required: false, type: Number })
  @ApiQuery({ name: 'categories', required: false })
  @ApiQuery({ name: 'dateFrom', required: false })
  @ApiQuery({ name: 'dateTo', required: false })
  @ApiQuery({ name: 'isPublic', required: false })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Get()
  async listReviews(
    @CurrentUser() user: { id: string; role: $Enums.UserRole },
    @Query() query: ReviewListQueryDto,
  ) {
    const {
      page = 1,
      limit = 10,
      contractId,
      clientId,
      artisanId,
      minRating,
      maxRating,
      categories: _categories,
      dateFrom,
      dateTo,
      isPublic: _isPublic,
    } = query;
    void _categories;
    void _isPublic;

    const skip = (page - 1) * limit;
    const take = Math.min(limit, 100);

    const where: any = {};

    // Non-admin users can see all reviews (all are public in current schema)
    if (user.role !== UserRole.ADMIN) {
      // No filtering needed - all reviews are public
    }

    if (contractId) where.contractId = contractId;
    if (clientId) where.clientId = clientId;
    if (artisanId) where.artisanId = artisanId;
    if (minRating || maxRating) {
      where.rating = {};
      if (minRating) where.rating.gte = minRating;
      if (maxRating) where.rating.lte = maxRating;
    }
    if (dateFrom || dateTo) {
      where.createdAt = {};
      if (dateFrom) where.createdAt.gte = new Date(dateFrom);
      if (dateTo) where.createdAt.lte = new Date(dateTo);
    }

    const [reviews, total] = await Promise.all([
      this.prisma.review.findMany({
        where,
        skip,
        take,
        include: {
          contract: {
            include: {
              job: {
                select: {
                  title: true,
                },
              },
            },
          },
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
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.review.count({ where }),
    ]);

    return {
      reviews: reviews.map((review) =>
        this.formatReviewResponse(review, review.contract),
      ),
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

  @ApiBearerAuth('bearer')
  @ApiOperation({ summary: 'Get current user reviews' })
  @ApiOkResponse({ description: 'User reviews retrieved successfully.' })
  @ApiForbiddenResponse({ description: 'Authentication required.' })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Get('me')
  async getMyReviews(
    @CurrentUser() user: { id: string; role: $Enums.UserRole },
  ) {
    const reviews = await this.prisma.review.findMany({
      where: {
        clientId: user.id,
      },
      include: {
        contract: {
          include: {
            job: {
              select: {
                title: true,
              },
            },
          },
        },
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
      },
      orderBy: { createdAt: 'desc' },
    });

    return reviews.map((review) =>
      this.formatReviewResponse(review, review.contract),
    );
  }

  @ApiBearerAuth('bearer')
  @ApiOperation({ summary: 'Get review by ID' })
  @ApiOkResponse({ description: 'Review retrieved successfully.' })
  @ApiNotFoundResponse({ description: 'Review not found.' })
  @ApiForbiddenResponse({ description: 'Access denied.' })
  @ApiParam({ name: 'id', description: 'Review ID' })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Get(':id')
  async getReview(
    @CurrentUser() user: { id: string; role: $Enums.UserRole },
    @Param('id') id: string,
  ): Promise<ReviewResponseDto> {
    const review = await this.prisma.review.findUnique({
      where: { id },
      include: {
        contract: {
          include: {
            job: {
              select: {
                title: true,
              },
            },
          },
        },
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
      },
    });

    if (!review) {
      throw new NotFoundException('Review not found');
    }

    // Check access - all reviews are public in current schema
    return this.formatReviewResponse(review, review.contract);
  }

  @ApiBearerAuth('bearer')
  @ApiOperation({ summary: 'Update review' })
  @ApiOkResponse({ description: 'Review updated successfully.' })
  @ApiNotFoundResponse({ description: 'Review not found.' })
  @ApiForbiddenResponse({ description: 'Access denied.' })
  @ApiBadRequestResponse({ description: 'Invalid update data.' })
  @ApiParam({ name: 'id', description: 'Review ID' })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Patch(':id')
  async updateReview(
    @CurrentUser() user: { id: string; role: $Enums.UserRole },
    @Param('id') id: string,
    @Body() updateDto: UpdateReviewDto,
  ): Promise<ReviewResponseDto> {
    const review = await this.prisma.review.findUnique({
      where: { id },
      include: {
        contract: {
          include: {
            job: {
              select: {
                title: true,
              },
            },
          },
        },
      },
    });

    if (!review) {
      throw new NotFoundException('Review not found');
    }

    // Check if user is the review owner or admin
    if (user.role !== UserRole.ADMIN && review.clientId !== user.id) {
      throw new ForbiddenException(
        'Access denied: You can only update your own reviews',
      );
    }

    const updateData: any = {
      ...(updateDto.rating !== undefined && { rating: updateDto.rating }),
      ...(updateDto.comment && { comment: updateDto.comment }),
      updatedAt: new Date(),
    };

    const updatedReview = await this.prisma.review.update({
      where: { id },
      data: updateData,
      include: {
        contract: {
          include: {
            job: {
              select: {
                title: true,
              },
            },
          },
        },
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
      },
    });

    return this.formatReviewResponse(updatedReview, updatedReview.contract);
  }

  @ApiBearerAuth('bearer')
  @ApiOperation({ summary: 'Get review statistics for an artisan' })
  @ApiOkResponse({ description: 'Review statistics retrieved successfully.' })
  @ApiNotFoundResponse({ description: 'Artisan not found.' })
  @ApiParam({ name: 'artisanId', description: 'Artisan ID' })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Get('stats/:artisanId')
  async getReviewStats(
    @Param('artisanId') artisanId: string,
  ): Promise<ReviewStatsDto> {
    const reviews = await this.prisma.review.findMany({
      where: {
        artisanId,
      },
    });

    const totalReviews = reviews.length;
    const averageRating =
      totalReviews > 0
        ? reviews.reduce((sum, review) => sum + review.rating, 0) / totalReviews
        : 0;

    const ratingDistribution = {
      1: reviews.filter((r) => r.rating === 1).length,
      2: reviews.filter((r) => r.rating === 2).length,
      3: reviews.filter((r) => r.rating === 3).length,
      4: reviews.filter((r) => r.rating === 4).length,
      5: reviews.filter((r) => r.rating === 5).length,
    };

    // Category averages are not available in the current schema
    const categoryAverages = {
      workQuality: 0,
      communication: 0,
      timeliness: 0,
      professionalism: 0,
    };

    return {
      totalReviews,
      averageRating,
      ratingDistribution,
      categoryAverages,
    };
  }

  private formatReviewResponse(review: any, contract?: any): ReviewResponseDto {
    return {
      id: review.id,
      contractId: review.contractId,
      clientId: review.clientId,
      artisanId: review.artisanId,
      rating: review.rating,
      comment: review.comment,
      categories: undefined, // Not available in current schema
      workQuality: undefined, // Not available in current schema
      communication: undefined, // Not available in current schema
      timeliness: undefined, // Not available in current schema
      professionalism: undefined, // Not available in current schema
      evidence: undefined, // Not available in current schema
      isPublic: true, // All reviews are public in current schema
      createdAt: review.createdAt.toISOString(),
      updatedAt: review.updatedAt?.toISOString() || undefined,
      contract: contract
        ? {
            id: contract.id,
            amount: contract.amount,
            status: contract.status,
            jobTitle: contract.job?.title || '',
          }
        : undefined,
      client: review.client,
      artisan: review.artisan,
    };
  }
}
