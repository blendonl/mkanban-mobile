import { ActionService } from '../../../services/ActionService';
import { ActionsConfig } from '../../../core/ActionsConfig';
import { IDaemonTask, DaemonTaskConfig, IPollingStrategy } from '../interfaces';

const DEFAULT_CONFIG: DaemonTaskConfig = {
  enabled: true,
  runInBackground: false,
};

export class OrphanCleanerTask implements IDaemonTask<number> {
  readonly name = 'OrphanCleaner';

  private config: DaemonTaskConfig;
  private intervalId: NodeJS.Timeout | null = null;
  private isRunning = false;

  constructor(
    private actionService: ActionService,
    private actionsConfig: ActionsConfig,
    private pollingStrategy: IPollingStrategy,
    config: Partial<DaemonTaskConfig> = {}
  ) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  async start(): Promise<void> {
    if (this.isRunning) {
      return;
    }

    if (!this.config.enabled || !this.actionsConfig.isEnabled()) {
      console.log(`[${this.name}] Task is disabled`);
      return;
    }

    this.isRunning = true;
    this.scheduleNextPoll();

    console.log(`[${this.name}] Started (polling every ${this.pollingStrategy.getInterval()}ms)`);
  }

  stop(): void {
    if (!this.isRunning) {
      return;
    }

    if (this.intervalId) {
      clearTimeout(this.intervalId);
      this.intervalId = null;
    }

    this.isRunning = false;
    console.log(`[${this.name}] Stopped`);
  }

  async execute(): Promise<number> {
    if (!this.config.enabled || !this.actionsConfig.isEnabled()) {
      return 0;
    }

    try {
      const count = await this.actionService.cleanOrphanedActions();
      if (count > 0) {
        console.log(`[${this.name}] Cleaned ${count} orphaned actions`);
      }
      return count;
    } catch (error) {
      console.error(`[${this.name}] Error cleaning orphaned actions:`, error);
      return 0;
    }
  }

  isActive(): boolean {
    return this.isRunning;
  }

  getConfig(): DaemonTaskConfig {
    return { ...this.config };
  }

  updateConfig(config: Partial<DaemonTaskConfig>): void {
    const wasRunning = this.isRunning;
    if (wasRunning) {
      this.stop();
    }

    this.config = { ...this.config, ...config };

    if (wasRunning && this.config.enabled) {
      this.start();
    }
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
}
