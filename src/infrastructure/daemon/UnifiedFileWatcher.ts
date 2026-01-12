import { FileChangeDetector, FileChange } from './FileChangeDetector';
import { FileSystemManager } from '../storage/FileSystemManager';
import { getEventBus, FileChangeEventPayload } from '../../core/EventBus';

export interface WatchConfig {
  pollingInterval: number;
  debounceDelay: number;
  enabled: boolean;
}

export class UnifiedFileWatcher {
  private detector: FileChangeDetector;
  private fileSystemManager: FileSystemManager;
  private config: WatchConfig;
  private intervalId: NodeJS.Timeout | null = null;
  private isRunning: boolean = false;
  private pendingChanges: FileChange[] = [];
  private debounceTimer: NodeJS.Timeout | null = null;
  private lastChangeTime: number = 0;
  private noChangeCount: number = 0;

  constructor(
    fileSystemManager: FileSystemManager,
    config: Partial<WatchConfig> = {}
  ) {
    this.fileSystemManager = fileSystemManager;
    this.detector = new FileChangeDetector();
    this.config = {
      pollingInterval: config.pollingInterval || 5000,
      debounceDelay: config.debounceDelay || 300,
      enabled: config.enabled !== undefined ? config.enabled : true,
    };
  }

  async start(): Promise<void> {
    if (this.isRunning) {
      console.warn('UnifiedFileWatcher is already running');
      return;
    }

    if (!this.config.enabled) {
      console.log('UnifiedFileWatcher is disabled');
      return;
    }

    this.isRunning = true;

    this.intervalId = setInterval(() => {
      this.checkForChanges();
    }, this.config.pollingInterval);

    await this.forceCheck();

    console.log(`UnifiedFileWatcher started (polling every ${this.config.pollingInterval}ms)`);
  }

  stop(): void {
    if (!this.isRunning) {
      console.warn('UnifiedFileWatcher is not running');
      return;
    }

    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }

    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }

    this.isRunning = false;
    console.log('UnifiedFileWatcher stopped');
  }

  async forceCheck(): Promise<void> {
    await this.checkForChanges();
    this.flushPendingChanges();
  }

  isActive(): boolean {
    return this.isRunning;
  }

  updateConfig(config: Partial<WatchConfig>): void {
    const wasRunning = this.isRunning;
    if (wasRunning) {
      this.stop();
    }

    this.config = { ...this.config, ...config };

    if (wasRunning && this.config.enabled) {
      this.start();
    }
  }

  getConfig(): WatchConfig {
    return { ...this.config };
  }

  reset(): void {
    this.stop();
    this.detector.reset();
    this.pendingChanges = [];
    this.lastChangeTime = 0;
    this.noChangeCount = 0;
  }

  private async checkForChanges(): Promise<void> {
    if (!this.config.enabled) {
      return;
    }

    try {
      const dataDir = this.fileSystemManager.getDataDirectory();
      const currentState = await this.detector.scanDirectory(dataDir);
      const changes = this.detector.detectChanges(currentState);

      if (changes.length > 0) {
        this.lastChangeTime = Date.now();
        this.noChangeCount = 0;
        this.pendingChanges.push(...changes);
        this.scheduleDebounce();
      } else {
        this.noChangeCount++;
        this.adjustPollingInterval();
      }

      this.detector.updateState(currentState);
    } catch (error) {
      console.error('Error checking for file changes:', error);
    }
  }

  private scheduleDebounce(): void {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }

    this.debounceTimer = setTimeout(() => {
      this.flushPendingChanges();
    }, this.config.debounceDelay);
  }

  private flushPendingChanges(): void {
    if (this.pendingChanges.length === 0) {
      return;
    }

    const changes = [...this.pendingChanges];
    this.pendingChanges = [];

    for (const change of changes) {
      this.emitChangeEvent(change);
    }
  }

  private emitChangeEvent(change: FileChange): void {
    if (change.isDirectory) {
      return;
    }

    const entityType = this.determineEntityType(change.path);
    if (!entityType) {
      return;
    }

    const eventBus = getEventBus();
    const payload: FileChangeEventPayload = {
      entityType,
      changeType: change.type,
      filePath: change.path,
      timestamp: new Date(),
    };

    eventBus.publishSync('file_changed', payload);
  }

  private determineEntityType(filePath: string): 'note' | 'agenda' | 'board' | 'project' | null {
    const dataDir = this.fileSystemManager.getDataDirectory();
    const relativePath = filePath.replace(dataDir, '');

    if (relativePath.includes('/agenda/')) {
      return 'agenda';
    }

    if (relativePath.includes('/notes/')) {
      return 'note';
    }

    if (relativePath.includes('/boards/') && relativePath.endsWith('.md')) {
      return 'board';
    }

    if (relativePath.includes('/projects/') && (relativePath.endsWith('project.yaml') || relativePath.endsWith('project.yml'))) {
      return 'project';
    }

    return null;
  }

  private adjustPollingInterval(): void {
    if (this.noChangeCount < 60) {
      return;
    }

    const currentInterval = this.config.pollingInterval;
    const newInterval = Math.min(currentInterval * 1.5, 15000);

    if (newInterval !== currentInterval) {
      console.log(`Adjusting polling interval from ${currentInterval}ms to ${newInterval}ms`);
      this.config.pollingInterval = newInterval;

      if (this.isRunning) {
        this.stop();
        this.start();
      }
    }
  }
}
