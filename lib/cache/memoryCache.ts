/**
 * High-performance In-Memory TTL Cache with In-Flight Request Coalescing (Thundering Herd Protection).
 * Zero external dependencies. Designed for Next.js App Router on VPS/Cloud (Hostinger).
 */

interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

class MemoryCache {
  private cache = new Map<string, CacheEntry<any>>();
  private inflight = new Map<string, Promise<any>>();

  /**
   * Retrieves an item from cache if valid. If expired or missing, executes the fetcher
   * with in-flight coalescing so that concurrent requests share the exact same promise.
   */
  async getOrSet<T>(
    key: string,
    fetcher: () => Promise<T>,
    ttlMs: number = 60000
  ): Promise<T> {
    const now = Date.now();
    const entry = this.cache.get(key);
    if (entry && entry.expiresAt > now) {
      return entry.data as T;
    }

    // Coalesce in-flight requests to eliminate cache stampedes / thundering herd
    const existingPromise = this.inflight.get(key);
    if (existingPromise) {
      return existingPromise as Promise<T>;
    }

    const fetchPromise = (async () => {
      try {
        const result = await fetcher();
        this.cache.set(key, {
          data: result,
          expiresAt: Date.now() + ttlMs,
        });
        return result;
      } finally {
        this.inflight.delete(key);
      }
    })();

    this.inflight.set(key, fetchPromise);
    return fetchPromise;
  }

  get<T>(key: string): T | null {
    const entry = this.cache.get(key);
    if (entry && entry.expiresAt > Date.now()) {
      return entry.data as T;
    }
    return null;
  }

  set<T>(key: string, data: T, ttlMs: number = 60000): void {
    this.cache.set(key, {
      data,
      expiresAt: Date.now() + ttlMs,
    });
  }

  /**
   * Invalidates a key or any key matching the given prefix.
   */
  invalidate(patternOrKey: string): void {
    if (this.cache.has(patternOrKey)) {
      this.cache.delete(patternOrKey);
    }
    for (const key of Array.from(this.cache.keys())) {
      if (key.startsWith(patternOrKey)) {
        this.cache.delete(key);
      }
    }
  }

  clear(): void {
    this.cache.clear();
    this.inflight.clear();
  }
}

// Global singleton instance across server requests
const globalForCache = globalThis as unknown as { serverCache?: MemoryCache };
export const serverCache = globalForCache.serverCache || new MemoryCache();
if (process.env.NODE_ENV !== 'production') {
  globalForCache.serverCache = serverCache;
}
