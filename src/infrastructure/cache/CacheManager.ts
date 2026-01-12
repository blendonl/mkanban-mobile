import { AppState, AppStateStatus } from 'react-native';
import { EntityCache } from './EntityCache';

type CacheType = 'notes' | 'agenda' | 'boards' | 'projects';

interface CacheConfig {
  ttl: number;
  maxSize: number;
}

const DEFAULT_CACHE_CONFIGS: Record<CacheType, CacheConfig> = {
  notes: { ttl: 300000, maxSize: 500 },
  agenda: { ttl: 300000, maxSize: 1000 },
  boards: { ttl: 300000, maxSize: 100 },
  projects: { ttl: 300000, maxSize: 50 },
};

export class CacheManager {
  private static instance: CacheManager | null = null;
  private caches: Map<CacheType, EntityCache<any>> = new Map();
  private appStateSubscription: any = null;
  private memoryWarningHandler: (() => void) | null = null;

  private constructor() {
    this.initializeCaches();
    this.monitorMemory();
  }

  static getInstance(): CacheManager {
    if (!CacheManager.instance) {
      CacheManager.instance = new CacheManager();
    }
    return CacheManager.instance;
  }

  static reset(): void {
    if (CacheManager.instance) {
      CacheManager.instance.destroy();
      CacheManager.instance = null;
    }
  }

  getCache<T>(type: CacheType): EntityCache<T> {
    const cache = this.caches.get(type);
    if (!cache) {
      throw new Error(`Cache not found for type: ${type}`);
    }
    return cache as EntityCache<T>;
  }

  invalidateAll(): void {
    for (const cache of this.caches.values()) {
      cache.clear();
    }
  }

  invalidateCache(type: CacheType): void {
    const cache = this.caches.get(type);
    if (cache) {
      cache.clear();
    }
  }

  getStats() {
    const stats: Record<string, any> = {};
    for (const [type, cache] of this.caches.entries()) {
      stats[type] = cache.getStats();
    }
    return stats;
  }

  updateConfig(type: CacheType, config: Partial<CacheConfig>): void {
    const currentConfig = DEFAULT_CACHE_CONFIGS[type];
    const newConfig = { ...currentConfig, ...config };

    const cache = new EntityCache(newConfig.ttl, newConfig.maxSize);
    this.caches.set(type, cache);
  }

  private initializeCaches(): void {
    for (const [type, config] of Object.entries(DEFAULT_CACHE_CONFIGS)) {
      this.caches.set(
        type as CacheType,
        new EntityCache(config.ttl, config.maxSize)
      );
    }
  }

  private monitorMemory(): void {
    this.appStateSubscription = AppState.addEventListener(
      'memoryWarning',
      this.handleMemoryWarning.bind(this)
    );
  }

  private handleMemoryWarning(): void {
    console.warn('Memory warning detected, clearing caches');
    this.invalidateAll();
  }

  private destroy(): void {
    if (this.appStateSubscription) {
      this.appStateSubscription.remove();
      this.appStateSubscription = null;
    }
    this.invalidateAll();
    this.caches.clear();
  }
}

export function getCacheManager(): CacheManager {
  return CacheManager.getInstance();
}
