import { ActionEngine } from '../../../services/ActionEngine';
import { ActionsConfig } from '../../../core/ActionsConfig';
import { IDaemonTask, DaemonTaskConfig, IPollingStrategy } from '../interfaces';

const DEFAULT_CONFIG: DaemonTaskConfig = {
  enabled: true,
  runInBackground: false,
};

export class ActionPollerTask implements IDaemonTask<void> {
  readonly name = 'ActionPoller';

  private config: DaemonTaskConfig;
  private intervalId: NodeJS.Timeout | null = null;
  private isRunning = false;

  constructor(
    private actionEngine: ActionEngine,
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

    this.execute().catch(error => {
      console.error(`[${this.name}] Initial evaluation failed:`, error);
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

    this.isRunning = false;
    console.log(`[${this.name}] Stopped`);
  }

  async execute(): Promise<void> {
    if (!this.config.enabled || !this.actionsConfig.isEnabled()) {
      return;
    }

    try {
      await this.actionEngine.evaluateTimeTriggers();
    } catch (error) {
      console.error(`[${this.name}] Error evaluating time triggers:`, error);
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

  async forceEvaluation(): Promise<void> {
    await this.execute();
    await this.actionEngine.evaluateInactivityTriggers();
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
