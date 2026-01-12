import AsyncStorage from '@react-native-async-storage/async-storage';

const FILE_WATCHER_CONFIG_KEY = '@mkanban:file_watcher_config';

export interface FileWatcherConfigData {
  enabled: boolean;
  pollingInterval: number;
  backgroundInterval: number;
  debounceDelay: number;
  cacheTTL: {
    notes: number;
    agenda: number;
    boards: number;
    projects: number;
  };
  cacheMaxSize: {
    notes: number;
    agenda: number;
    boards: number;
    projects: number;
  };
}

const DEFAULT_CONFIG: FileWatcherConfigData = {
  enabled: true,
  pollingInterval: 5000,
  backgroundInterval: 900000,
  debounceDelay: 300,
  cacheTTL: {
    notes: 300000,
    agenda: 300000,
    boards: 300000,
    projects: 300000,
  },
  cacheMaxSize: {
    notes: 500,
    agenda: 1000,
    boards: 100,
    projects: 50,
  },
};

export class FileWatcherConfig {
  private config: FileWatcherConfigData = DEFAULT_CONFIG;
  private loaded: boolean = false;

  async load(): Promise<void> {
    try {
      const stored = await AsyncStorage.getItem(FILE_WATCHER_CONFIG_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        this.config = { ...DEFAULT_CONFIG, ...parsed };
      }
      this.loaded = true;
    } catch (error) {
      console.error('Failed to load FileWatcherConfig:', error);
      this.config = DEFAULT_CONFIG;
      this.loaded = true;
    }
  }

  async save(): Promise<void> {
    try {
      await AsyncStorage.setItem(FILE_WATCHER_CONFIG_KEY, JSON.stringify(this.config));
    } catch (error) {
      console.error('Failed to save FileWatcherConfig:', error);
    }
  }

  getConfig(): FileWatcherConfigData {
    return { ...this.config };
  }

  async updateConfig(updates: Partial<FileWatcherConfigData>): Promise<void> {
    this.config = { ...this.config, ...updates };
    await this.save();
  }

  isEnabled(): boolean {
    return this.config.enabled;
  }

  async setEnabled(enabled: boolean): Promise<void> {
    this.config.enabled = enabled;
    await this.save();
  }

  getPollingInterval(): number {
    return this.config.pollingInterval;
  }

  getBackgroundInterval(): number {
    return this.config.backgroundInterval;
  }

  getDebounceDelay(): number {
    return this.config.debounceDelay;
  }

  getCacheTTL(type: keyof FileWatcherConfigData['cacheTTL']): number {
    return this.config.cacheTTL[type];
  }

  getCacheMaxSize(type: keyof FileWatcherConfigData['cacheMaxSize']): number {
    return this.config.cacheMaxSize[type];
  }

  isLoaded(): boolean {
    return this.loaded;
  }

  resetToDefaults(): void {
    this.config = { ...DEFAULT_CONFIG };
  }
}

let instance: FileWatcherConfig | null = null;

export function getFileWatcherConfig(): FileWatcherConfig {
  if (!instance) {
    instance = new FileWatcherConfig();
  }
  return instance;
}
