import { Module } from '@nestjs/common';
import { ArtisanService } from './artisan.service';

@Module({
  providers: [ArtisanService],
  exports: [ArtisanService],
})
export class ArtisanModule {}
