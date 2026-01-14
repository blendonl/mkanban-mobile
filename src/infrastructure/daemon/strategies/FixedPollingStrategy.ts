import { IPollingStrategy } from '../interfaces';

export class FixedPollingStrategy implements IPollingStrategy {
  private interval: number;

  constructor(interval: number) {
    this.interval = interval;
  }

  getInterval(): number {
    return this.interval;
  }

  onActivity(): void {}

  onIdle(): void {}

  reset(): void {}

  setInterval(interval: number): void {
    this.interval = interval;
  }
}
