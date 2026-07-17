import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { Worker, Job } from 'bullmq';
import { redisConnection } from '../../queue/redis';
import { PrismaService } from '../../database/prisma.service';
import { ReviewStatus } from '../../generated/prisma';

@Injectable()
export class ReputationService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ReputationService.name);
  private worker: Worker;

  constructor(private readonly prisma: PrismaService) {}

  onModuleInit() {
    this.worker = new Worker(
      'reputation-queue',
      async (job: Job) => {
        const { userId } = job.data;
        if (!userId) throw new Error('Missing userId');
        
        this.logger.log(`⚙️ Calculating reputation for user ${userId}`);
        await this.calculateReputation(userId);
        
        return { success: true };
      },
      {
        connection: redisConnection as any,
        concurrency: 2,
      }
    );

    this.worker.on('failed', (job, err) => {
      this.logger.error(`❌ Reputation calculation failed for ${job?.data?.userId}: ${err.message}`);
    });

    this.logger.log('🚀 Reputation Engine Worker started.');
  }

  async calculateReputation(userId: string) {
    // 1. Get all VISIBLE reviews for this user
    const aggregate = await this.prisma.review.aggregate({
      where: { targetId: userId, status: ReviewStatus.VISIBLE },
      _avg: { rating: true },
      _count: { id: true }
    });

    const avgRating = aggregate._avg.rating ? Number(aggregate._avg.rating) : 0;
    const reviewCount = aggregate._count.id;

    // 2. Calculate Job Success Score (jssScore)
    let jss = 100;
    if (reviewCount > 0) {
      const positiveReviews = await this.prisma.review.count({
        where: { targetId: userId, status: ReviewStatus.VISIBLE, rating: { gte: 4 } }
      });
      jss = Math.round((positiveReviews / reviewCount) * 100);
    }

    // 3. Update ReputationProfile
    await this.prisma.reputationProfile.upsert({
      where: { userId },
      update: { averageRating: avgRating, totalReviews: reviewCount, jssScore: jss },
      create: { userId, averageRating: avgRating, totalReviews: reviewCount, jssScore: jss }
    });

    // 4. Also update ArtisanProfile if they are an artisan
    const artisanProfile = await this.prisma.artisanProfile.findUnique({ where: { userId } });
    if (artisanProfile) {
      await this.prisma.artisanProfile.update({
        where: { userId },
        data: { rating: avgRating, reviewCount }
      });
    }
  }

  async onModuleDestroy() {
    this.logger.log('Shutting down Reputation Engine Worker...');
    await this.worker?.close();
  }
}
