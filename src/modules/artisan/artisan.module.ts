import { Module } from '@nestjs/common';
import { PrismaModule } from '../../database/prisma.module';
import { ArtisanService } from './artisan.service';
import { ArtisanController } from './artisan.controller';

@Module({
  imports: [PrismaModule],
  controllers: [ArtisanController],
  providers: [ArtisanService],
  exports: [ArtisanService],
})
export class ArtisanModule {}
