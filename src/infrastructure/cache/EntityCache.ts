import { CacheMemoryError } from '../../domain/errors/CacheError';

interface CacheEntry<T> {
  value: T;
  timestamp: number;
  accessCount: number;
  lastAccessed: number;
}

export class EntityCache<T> {
  private cache: Map<string, CacheEntry<T>> = new Map();
  private listCache: T[] | null = null;
  private listCacheTimestamp: number = 0;
  private ttl: number;
  private maxSize: number;

  constructor(ttl: number = 300000, maxSize: number = 500) {
    this.ttl = ttl;
    this.maxSize = maxSize;
  }

  set(key: string, value: T): void {
    if (this.cache.size >= this.maxSize && !this.cache.has(key)) {
      this.evictLRU();
    }

    this.cache.set(key, {
      value,
      timestamp: Date.now(),
      accessCount: 0,
      lastAccessed: Date.now(),
    });
  }

  get(key: string): T | undefined {
    const entry = this.cache.get(key);
    if (!entry) {
      return undefined;
    }

    if (this.isEntryExpired(entry)) {
      this.cache.delete(key);
      return undefined;
    }

    entry.accessCount++;
    entry.lastAccessed = Date.now();
    return entry.value;
  }

  setList(items: T[]): void {
    this.listCache = items;
    this.listCacheTimestamp = Date.now();
  }

  getList(): T[] | null {
    if (!this.listCache || this.isListExpired()) {
      return null;
    }
    return this.listCache;
  }

  invalidate(key?: string): void {
    if (key) {
      this.cache.delete(key);
    } else {
      this.cache.clear();
    }
  }

  invalidateList(): void {
    this.listCache = null;
    this.listCacheTimestamp = 0;
  }

  clear(): void {
    this.cache.clear();
    this.listCache = null;
    this.listCacheTimestamp = 0;
  }

  isExpired(): boolean {
    return this.isListExpired();
  }

  has(key: string): boolean {
    const entry = this.cache.get(key);
    if (!entry) {
      return false;
    }
    if (this.isEntryExpired(entry)) {
      this.cache.delete(key);
      return false;
    }
    return true;
  }

  getSize(): number {
    return this.cache.size;
  }

  getStats() {
    return {
      size: this.cache.size,
      maxSize: this.maxSize,
      ttl: this.ttl,
      listCached: this.listCache !== null,
      listExpired: this.isListExpired(),
    };
  }

  private isEntryExpired(entry: CacheEntry<T>): boolean {
    return Date.now() - entry.timestamp > this.ttl;
  }

  private isListExpired(): boolean {
    if (this.listCacheTimestamp === 0) {
      return true;
    }
    return Date.now() - this.listCacheTimestamp > this.ttl;
  }

  private evictLRU(): void {
    if (this.cache.size === 0) {
      return;
    }

    let lruKey: string | null = null;
    let oldestAccess = Date.now();

    for (const [key, entry] of this.cache.entries()) {
      if (entry.lastAccessed < oldestAccess) {
        oldestAccess = entry.lastAccessed;
        lruKey = key;
      }
    }

    if (lruKey) {
      this.cache.delete(lruKey);
    } else if (this.cache.size >= this.maxSize) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey) {
        this.cache.delete(firstKey);
      }
    }
  }
}
