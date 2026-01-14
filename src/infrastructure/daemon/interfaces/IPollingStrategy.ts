export interface PollingStrategyConfig {
  baseInterval: number;
  maxInterval: number;
  idleThreshold: number;
  backoffMultiplier: number;
}

export interface IPollingStrategy {
  getInterval(): number;
  onActivity(): void;
  onIdle(): void;
  reset(): void;
}
