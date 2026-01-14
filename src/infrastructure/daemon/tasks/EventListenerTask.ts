import { ActionEngine } from '../../../services/ActionEngine';
import { ActionsConfig } from '../../../core/ActionsConfig';
import { getEventBus, EventType, EventPayload, EventSubscription } from '../../../core/EventBus';
import { IDaemonTask, DaemonTaskConfig } from '../interfaces';

const EVENT_TYPES: EventType[] = [
  'task_created',
  'task_updated',
  'task_deleted',
  'task_moved',
  'board_created',
  'board_loaded',
  'board_updated',
  'board_deleted',
  'board_switched',
  'board_enter',
  'board_exit',
  'column_created',
  'column_updated',
  'column_deleted',
  'git_branch_created',
  'git_branch_deleted',
  'git_branch_merged',
  'git_commit_made',
];

const DEFAULT_CONFIG: DaemonTaskConfig = {
  enabled: true,
  runInBackground: false,
};

export class EventListenerTask implements IDaemonTask<void> {
  readonly name = 'EventListener';

  private config: DaemonTaskConfig;
  private subscriptions: EventSubscription[] = [];
  private isRunning = false;

  constructor(
    private actionEngine: ActionEngine,
    private actionsConfig: ActionsConfig,
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
    this.subscribeToEvents();

    console.log(`[${this.name}] Started (subscribed to ${EVENT_TYPES.length} event types)`);
  }

  stop(): void {
    if (!this.isRunning) {
      return;
    }

    this.subscriptions.forEach(sub => sub.unsubscribe());
    this.subscriptions = [];

    this.isRunning = false;
    console.log(`[${this.name}] Stopped`);
  }

  async execute(): Promise<void> {}

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

  private subscribeToEvents(): void {
    const eventBus = getEventBus();

    for (const eventType of EVENT_TYPES) {
      const subscription = eventBus.subscribe(eventType, async (payload: EventPayload) => {
        try {
          await this.actionEngine.evaluateEventTriggers(eventType, payload);
        } catch (error) {
          console.error(`[${this.name}] Error evaluating event triggers for ${eventType}:`, error);
        }
      });

      this.subscriptions.push(subscription);
    }
  }
}
