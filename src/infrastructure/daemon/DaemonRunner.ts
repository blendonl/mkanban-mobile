import { AppState, AppStateStatus } from 'react-native';
import { getEventBus } from '../../core/EventBus';
import { IDaemonTask } from './interfaces';

export interface DaemonStatus {
  running: boolean;
  taskCount: number;
  activeTasks: string[];
}

export class DaemonRunner {
  private tasks: Map<string, IDaemonTask<unknown>> = new Map();
  private appStateSubscription: any = null;
  private isRunning = false;

  registerTask(task: IDaemonTask<unknown>): void {
    if (this.tasks.has(task.name)) {
      console.warn(`[DaemonRunner] Task '${task.name}' already registered, replacing`);
    }
    this.tasks.set(task.name, task);
    console.log(`[DaemonRunner] Registered task: ${task.name}`);
  }

  unregisterTask(taskName: string): void {
    const task = this.tasks.get(taskName);
    if (task) {
      if (task.isActive()) {
        task.stop();
      }
      this.tasks.delete(taskName);
      console.log(`[DaemonRunner] Unregistered task: ${taskName}`);
    }
  }

  async start(): Promise<void> {
    if (this.isRunning) {
      console.log('[DaemonRunner] Already running');
      return;
    }

    console.log('[DaemonRunner] Starting...');
    this.isRunning = true;

    this.monitorAppState();

    const startPromises = Array.from(this.tasks.values()).map(async task => {
      try {
        await task.start();
      } catch (error) {
        console.error(`[DaemonRunner] Failed to start task '${task.name}':`, error);
      }
    });

    await Promise.all(startPromises);
    console.log('[DaemonRunner] Started');
  }

  async stop(): Promise<void> {
    if (!this.isRunning) {
      console.log('[DaemonRunner] Not running');
      return;
    }

    console.log('[DaemonRunner] Stopping...');

    if (this.appStateSubscription) {
      this.appStateSubscription.remove();
      this.appStateSubscription = null;
    }

    for (const task of this.tasks.values()) {
      try {
        task.stop();
      } catch (error) {
        console.error(`[DaemonRunner] Failed to stop task '${task.name}':`, error);
      }
    }

    this.isRunning = false;
    console.log('[DaemonRunner] Stopped');
  }

  async restart(): Promise<void> {
    await this.stop();
    await this.start();
  }

  pause(): void {
    console.log('[DaemonRunner] Pausing tasks...');
    for (const task of this.tasks.values()) {
      if (task.isActive()) {
        task.stop();
      }
    }
  }

  async resume(): Promise<void> {
    console.log('[DaemonRunner] Resuming tasks...');
    const resumePromises = Array.from(this.tasks.values()).map(async task => {
      if (!task.isActive() && task.getConfig().enabled) {
        try {
          await task.start();
        } catch (error) {
          console.error(`[DaemonRunner] Failed to resume task '${task.name}':`, error);
        }
      }
    });

    await Promise.all(resumePromises);
  }

  getTask<T extends IDaemonTask<unknown>>(name: string): T | undefined {
    return this.tasks.get(name) as T | undefined;
  }

  isActive(): boolean {
    return this.isRunning;
  }

  getStatus(): DaemonStatus {
    const activeTasks = Array.from(this.tasks.values())
      .filter(task => task.isActive())
      .map(task => task.name);

    return {
      running: this.isRunning,
      taskCount: this.tasks.size,
      activeTasks,
    };
  }

  private monitorAppState(): void {
    this.appStateSubscription = AppState.addEventListener(
      'change',
      this.handleAppStateChange.bind(this)
    );
  }

  private async handleAppStateChange(nextAppState: AppStateStatus): Promise<void> {
    const eventBus = getEventBus();

    if (nextAppState === 'active') {
      console.log('[DaemonRunner] App came to foreground');
      await eventBus.publish('app_foreground', { timestamp: new Date() });
      await this.resume();
    } else if (nextAppState === 'background') {
      console.log('[DaemonRunner] App went to background');
      await eventBus.publish('app_background', { timestamp: new Date() });
      this.pause();
    }
  }
}
