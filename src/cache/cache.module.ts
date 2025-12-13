import { Global, Module } from '@nestjs/common';

import { ServiceCache } from './service-cache';
import { ValkeyClientProvider } from './valkey.provider';
import { CacheService } from './cache.service';

@Global()
@Module({
  providers: [ValkeyClientProvider, CacheService, ServiceCache],
  exports: [CacheService, ServiceCache],
})
export class CacheModule {}
