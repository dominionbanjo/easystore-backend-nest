import { Injectable } from '@nestjs/common';
import { CacheService } from './cache.service';

@Injectable()
export class ServiceCache {
  constructor(private cache: CacheService) {}

  key(domain: string, action: string, identifier?: string | object): string {
    const hash = identifier ? this.cache.hash(identifier) : '';
    return `svc:${domain}:${action}:${hash}`;
  }

  async get<T>(key: string): Promise<T | null> {
    return this.cache.get<T>(key);
  }

  async set<T>(key: string, value: T, ttl?: number): Promise<void> {
    return this.cache.set(key, value, ttl);
  }

  async clear(prefix: string): Promise<void> {
    return this.cache.clearPrefix(prefix);
  }
}
