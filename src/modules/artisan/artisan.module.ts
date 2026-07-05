import { Module, forwardRef } from '@nestjs/common';
import { PrismaModule } from '../../database/prisma.module';
import { ArtisanService } from './artisan.service';
import { ArtisanController } from './artisan.controller';
import { AuthModule } from '../auth/auth.module';

import { AppCacheModule } from '../../common/cache/cache.module';

@Module({
  imports: [PrismaModule, forwardRef(() => AuthModule), AppCacheModule],
  controllers: [ArtisanController],
  providers: [ArtisanService],
  exports: [ArtisanService],
})
export class ArtisanModule {}
