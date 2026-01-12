import { AppState, AppStateStatus } from 'react-native';
import { UnifiedFileWatcher } from './UnifiedFileWatcher';
import { FileSystemManager } from '../storage/FileSystemManager';
import { getEventBus, EventSubscription } from '../../core/EventBus';

export class FileWatcherDaemon {
  private watcher: UnifiedFileWatcher;
  private isRunning: boolean = false;
  private appStateSubscription: any = null;
  private eventSubscriptions: EventSubscription[] = [];

  constructor(fileSystemManager: FileSystemManager) {
    this.watcher = new UnifiedFileWatcher(fileSystemManager);
  }

  async start(): Promise<void> {
    if (this.isRunning) {
      console.log('FileWatcherDaemon already running');
      return;
    }

    console.log('Starting FileWatcherDaemon...');
    this.isRunning = true;

    await this.watcher.start();

    this.monitorAppState();
    this.subscribeToEvents();

    console.log('FileWatcherDaemon started');
  }

  async stop(): Promise<void> {
    if (!this.isRunning) {
      console.log('FileWatcherDaemon not running');
      return;
    }

    console.log('Stopping FileWatcherDaemon...');
    this.isRunning = false;

    this.watcher.stop();

    if (this.appStateSubscription) {
      this.appStateSubscription.remove();
      this.appStateSubscription = null;
    }

    this.eventSubscriptions.forEach((sub) => sub.unsubscribe());
    this.eventSubscriptions = [];

    console.log('FileWatcherDaemon stopped');
  }

  async restart(): Promise<void> {
    await this.stop();
    await this.start();
  }

  isActive(): boolean {
    return this.isRunning;
  }

  async forceCheck(): Promise<void> {
    if (!this.isRunning) {
      console.warn('FileWatcherDaemon is not running, cannot force check');
      return;
    }
    await this.watcher.forceCheck();
  }

  updateConfig(config: { pollingInterval?: number; debounceDelay?: number; enabled?: boolean }): void {
    this.watcher.updateConfig(config);
  }

  getStatus() {
    return {
      running: this.isRunning,
      watcherActive: this.watcher.isActive(),
      config: this.watcher.getConfig(),
    };
  }

  private monitorAppState(): void {
    this.appStateSubscription = AppState.addEventListener(
      'change',
      this.handleAppStateChange.bind(this)
    );
  }

  private async handleAppStateChange(nextAppState: AppStateStatus): Promise<void> {
    if (nextAppState === 'active') {
      console.log('App came to foreground, resuming file watcher');
      if (this.isRunning && !this.watcher.isActive()) {
        await this.watcher.start();
      }
      await this.watcher.forceCheck();
    } else if (nextAppState === 'background') {
      console.log('App went to background, pausing file watcher');
      if (this.watcher.isActive()) {
        this.watcher.stop();
      }
    }
  }

  private subscribeToEvents(): void {
    const eventBus = getEventBus();

    const foregroundSub = eventBus.subscribe('app_foreground', async () => {
      await this.watcher.forceCheck();
    });

    this.eventSubscriptions.push(foregroundSub);
  }
}
