import { Module } from '@nestjs/common';
import { ReviewsController } from './reviews.controller';
import { ReviewsService } from './reviews.service';
import { PrismaModule } from '../../database/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { ReviewsEventListener } from './reviews.listener';
import { ReputationService } from './reputation.service';

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [ReviewsController],
  providers: [ReviewsService, ReviewsEventListener, ReputationService],
  exports: [ReviewsService],
})
export class ReviewsModule {}
