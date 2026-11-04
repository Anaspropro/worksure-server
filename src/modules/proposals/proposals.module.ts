import { Module } from '@nestjs/common';
import { PrismaModule } from '../../database/prisma.module';
import { ProposalsService } from './proposals.service';
import { ProposalsController } from './proposals.controller';
import { AuthModule } from '../auth/auth.module';
import { ProposalsCron } from './proposals.cron';

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [ProposalsController],
  providers: [ProposalsService, ProposalsCron],
  exports: [ProposalsService],
})
export class ProposalsModule {}
