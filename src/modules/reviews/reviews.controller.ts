import {
  Controller,
  Get,
  Post,
  Body,
  UseGuards,
  Param,
} from '@nestjs/common';
import { ReviewsService } from './reviews.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../auth/auth.service';

@ApiTags('Reviews')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('reviews')
export class ReviewsController {
  constructor(private readonly reviewsService: ReviewsService) {}

  @Get('eligible')
  @ApiOperation({ summary: 'Get contracts eligible for review' })
  async getEligibleReviews(@CurrentUser() user: AuthenticatedUser) {
    return this.reviewsService.getEligibleReviews(user.id);
  }

  @Get('reputation/:userId')
  @ApiOperation({ summary: 'Get reputation profile for a user' })
  async getReputationProfile(@Param('userId') userId: string) {
    return this.reviewsService.getReputationProfile(userId);
  }

  @Post(':contractId/submit')
  @ApiOperation({ summary: 'Submit a review for a contract' })
  async submitReview(
    @CurrentUser() user: AuthenticatedUser,
    @Param('contractId') contractId: string,
    @Body()
    body: {
      targetId: string;
      rating: number;
      comment?: string;
      breakdown?: any;
    },
  ) {
    return this.reviewsService.submitReview(
      user.id,
      contractId,
      body.targetId,
      body.rating,
      body.comment,
      body.breakdown,
    );
  }
}
