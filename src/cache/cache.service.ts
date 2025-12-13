import { Inject, Injectable } from '@nestjs/common';
import Redis from 'ioredis';
import * as crypto from 'crypto';

@Injectable()
export class CacheService {
  constructor(@Inject('VALKEY_CLIENT') private readonly client: Redis | null) {}

  // -----------------------------
  // GET (with generics)
  // -----------------------------
  async get<T>(key: string): Promise<T | null> {
    if (!this.client) return null;

    const raw = await this.client.get(key);
    if (!raw) return null;

    try {
      return JSON.parse(raw) as T;
    } catch {
      return null;
    }
  }

  // -----------------------------
  // SET
  // -----------------------------
  async set<T>(key: string, value: T, ttl = 60): Promise<void> {
    if (!this.client) return;

    await this.client.set(key, JSON.stringify(value), 'EX', ttl);
  }

  // -----------------------------
  // CLEAR PREFIX
  // -----------------------------
  async clearPrefix(prefix: string): Promise<void> {
    if (!this.client) return;

    const keys = await this.client.keys(`${prefix}*`);
    if (keys.length === 0) return;

    await this.client.del(...keys);
  }

  // -----------------------------
  // SAFE HASH FOR CACHE KEYS
  // -----------------------------
  hash(input: string | object): string {
    const str = typeof input === 'string' ? input : JSON.stringify(input);
    return crypto.createHash('md5').update(str).digest('hex');
  }
}
