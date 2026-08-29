import { LRUCache } from 'lru-cache';

export interface CacheEntry<T> {
  value: T;
  storedAt: number;
}

/**
 * Thin TTL cache wrapper. Positive results get the long TTL; negative results
 * (404s) get a short TTL so repeated bad URLs don't keep hitting LinkedIn.
 */
export class ProfileCache<T extends {}> {
  private readonly cache: LRUCache<string, CacheEntry<T>>;

  constructor(
    private readonly ttlMs: number,
    max = 1000,
  ) {
    this.cache = new LRUCache({ max, ttl: ttlMs, ttlAutopurge: false });
  }

  get(key: string): T | undefined {
    return this.cache.get(key)?.value;
  }

  set(key: string, value: T, ttlMs?: number): void {
    this.cache.set(key, { value, storedAt: Date.now() }, ttlMs ? { ttl: ttlMs } : undefined);
  }

  delete(key: string): void {
    this.cache.delete(key);
  }
}
