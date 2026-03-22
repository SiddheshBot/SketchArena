import { logger } from './Logger';

/**
 * Server-driven countdown timer.
 *
 * Instead of sending remaining seconds every tick (which drifts with latency),
 * we send an absolute `endsAt` timestamp once. Clients compute the countdown
 * locally: `remaining = endsAt - Date.now()`.
 */
export class GameTimer {
  private ref: ReturnType<typeof setTimeout> | null = null;
  private _endsAt: number = 0;

  get endsAt(): number {
    return this._endsAt;
  }

  /**
   * Start a countdown. Calls `onExpire` when the duration elapses.
   */
  start(durationMs: number, onExpire: () => void): number {
    this.clear();
    this._endsAt = Date.now() + durationMs;

    this.ref = setTimeout(() => {
      logger.debug('Timer expired', { endsAt: this._endsAt });
      onExpire();
    }, durationMs);

    return this._endsAt;
  }

  /**
   * Clear the running timer.
   */
  clear(): void {
    if (this.ref) {
      clearTimeout(this.ref);
      this.ref = null;
    }
  }

  /**
   * Returns remaining time in ms, or 0 if expired.
   */
  remaining(): number {
    return Math.max(0, this._endsAt - Date.now());
  }
}
