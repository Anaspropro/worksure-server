import { Module } from '@nestjs/common';
import { PrismaModule } from '../../database/prisma.module';
import { DisputesService } from './disputes.service';
import { DisputesController } from './disputes.controller';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [DisputesController],
  providers: [DisputesService],
  exports: [DisputesService],
})
export class DisputesModule {}
