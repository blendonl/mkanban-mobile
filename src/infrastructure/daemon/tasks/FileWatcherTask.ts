import { FileSystemManager } from '../../storage/FileSystemManager';
import { getEventBus, FileChangeEventPayload } from '../../../core/EventBus';
import { IDaemonTask, DaemonTaskConfig, IChangeDetector, IPollingStrategy, IFileChangeMapper, FileChange } from '../interfaces';

export interface FileWatcherTaskConfig extends DaemonTaskConfig {
  debounceDelay: number;
}

const DEFAULT_CONFIG: FileWatcherTaskConfig = {
  enabled: true,
  runInBackground: false,
  debounceDelay: 300,
};

export class FileWatcherTask implements IDaemonTask<FileChange[]> {
  readonly name = 'FileWatcher';

  private config: FileWatcherTaskConfig;
  private intervalId: NodeJS.Timeout | null = null;
  private debounceTimer: NodeJS.Timeout | null = null;
  private isRunning = false;
  private pendingChanges: FileChange[] = [];

  constructor(
    private fileSystemManager: FileSystemManager,
    private detector: IChangeDetector,
    private pollingStrategy: IPollingStrategy,
    private mapper: IFileChangeMapper,
    config: Partial<FileWatcherTaskConfig> = {}
  ) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  async start(): Promise<void> {
    if (this.isRunning) {
      return;
    }

    if (!this.config.enabled) {
      console.log(`[${this.name}] Task is disabled`);
      return;
    }

    this.isRunning = true;
    this.scheduleNextPoll();

    console.log(`[${this.name}] Started (polling every ${this.pollingStrategy.getInterval()}ms)`);

    this.execute().catch(error => {
      console.error(`[${this.name}] Initial scan failed:`, error);
    });
  }

  stop(): void {
    if (!this.isRunning) {
      return;
    }

    if (this.intervalId) {
      clearTimeout(this.intervalId);
      this.intervalId = null;
    }

    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }

    this.isRunning = false;
    console.log(`[${this.name}] Stopped`);
  }

  async execute(): Promise<FileChange[]> {
    if (!this.config.enabled) {
      return [];
    }

    try {
      const dataDir = this.fileSystemManager.getDataDirectory();
      const currentState = await this.detector.scanDirectory(dataDir);
      const changes = this.detector.detectChanges(currentState);

      if (changes.length > 0) {
        this.pollingStrategy.onActivity();
        this.pendingChanges.push(...changes);
        this.scheduleDebounce();
      } else {
        this.pollingStrategy.onIdle();
      }

      this.detector.updateState(currentState);
      return changes;
    } catch (error) {
      console.error(`[${this.name}] Error checking for changes:`, error);
      return [];
    }
  }

  isActive(): boolean {
    return this.isRunning;
  }

  getConfig(): FileWatcherTaskConfig {
    return { ...this.config };
  }

  updateConfig(config: Partial<FileWatcherTaskConfig>): void {
    const wasRunning = this.isRunning;
    if (wasRunning) {
      this.stop();
    }

    this.config = { ...this.config, ...config };

    if (wasRunning && this.config.enabled) {
      this.start();
    }
  }

  async forceCheck(): Promise<void> {
    await this.execute();
    this.flushPendingChanges();
  }

  reset(): void {
    this.stop();
    this.detector.reset();
    this.pollingStrategy.reset();
    this.pendingChanges = [];
  }

  private scheduleNextPoll(): void {
    if (!this.isRunning) {
      return;
    }

    this.intervalId = setTimeout(async () => {
      await this.execute();
      this.scheduleNextPoll();
    }, this.pollingStrategy.getInterval());
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
    const mappedChange = this.mapper.map(change);
    if (!mappedChange) {
      return;
    }

    const eventBus = getEventBus();
    const changeType = mappedChange.changeType === 'added' ? 'created' : mappedChange.changeType;
    const payload: FileChangeEventPayload = {
      entityType: mappedChange.entityType,
      changeType,
      filePath: mappedChange.filePath,
      timestamp: new Date(),
    };

    eventBus.publishSync('file_changed', payload);
  }
}
