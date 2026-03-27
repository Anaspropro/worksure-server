import { Module } from '@nestjs/common';
import { ProposalsService } from './proposals.service';

@Module({
  providers: [ProposalsService],
  exports: [ProposalsService],
})
export class ProposalsModule {}
