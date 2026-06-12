import { Global, Module } from '@nestjs/common';
import { CacheModule } from '@nestjs/cache-manager';
import { MemoryCacheService } from './memory-cache.service';

@Global()
@Module({
  imports: [
    CacheModule.register({
      // Default TTL in milliseconds (e.g., 5 minutes)
      ttl: 5 * 60 * 1000,
      // Maximum number of items in cache
      max: 1000,
      isGlobal: true,
    }),
  ],
  providers: [MemoryCacheService],
  exports: [MemoryCacheService],
})
export class AppCacheModule {}
