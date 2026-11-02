import { Global, Module } from '@nestjs/common';
import { RedisCacheService } from './redis-cache.service';
import { InMemoryCacheService } from './in-memory-cache.service';

@Global()
@Module({
  providers: [InMemoryCacheService, RedisCacheService],
  exports: [InMemoryCacheService, RedisCacheService],
})
export class AppCacheModule {}
