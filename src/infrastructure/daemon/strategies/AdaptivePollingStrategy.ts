import { IPollingStrategy, PollingStrategyConfig } from '../interfaces';

const DEFAULT_CONFIG: PollingStrategyConfig = {
  baseInterval: 5000,
  maxInterval: 15000,
  idleThreshold: 60,
  backoffMultiplier: 1.5,
};

export class AdaptivePollingStrategy implements IPollingStrategy {
  private config: PollingStrategyConfig;
  private currentInterval: number;
  private idleCount: number = 0;

  constructor(config: Partial<PollingStrategyConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.currentInterval = this.config.baseInterval;
  }

  getInterval(): number {
    return this.currentInterval;
  }

  onActivity(): void {
    this.idleCount = 0;
    this.currentInterval = this.config.baseInterval;
  }

  onIdle(): void {
    this.idleCount++;

    if (this.idleCount < this.config.idleThreshold) {
      return;
    }

    const newInterval = Math.min(
      this.currentInterval * this.config.backoffMultiplier,
      this.config.maxInterval
    );

    if (newInterval !== this.currentInterval) {
      console.log(`[AdaptivePolling] Increasing interval from ${this.currentInterval}ms to ${newInterval}ms`);
      this.currentInterval = newInterval;
    }
  }

  reset(): void {
    this.idleCount = 0;
    this.currentInterval = this.config.baseInterval;
  }
}
