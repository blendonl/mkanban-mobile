export interface DaemonTaskConfig {
  enabled: boolean;
  runInBackground: boolean;
}

export interface IDaemonTask<TResult = void> {
  readonly name: string;
  start(): Promise<void>;
  stop(): void;
  execute(): Promise<TResult>;
  isActive(): boolean;
  getConfig(): DaemonTaskConfig;
  updateConfig(config: Partial<DaemonTaskConfig>): void;
}
