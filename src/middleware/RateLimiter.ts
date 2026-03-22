import { logger } from '../utils/Logger';

/**
 * Token Bucket Rate Limiter
 *
 * Strategy: Each bucket has a maximum number of tokens. Tokens are consumed
 * on each request and refilled at a steady rate. If the bucket is empty,
 * the request is rejected — demonstrating controlled throughput.
 *
 * Why token bucket over sliding window?
 * - Allows small bursts (good for rapid draw strokes) while enforcing average rate
 * - O(1) per check — no need to store individual request timestamps
 * - Simple to reason about: "max 5 guesses/sec with burst of 5"
 */

interface BucketConfig {
  maxTokens: number;        // bucket capacity (also burst size)
  refillRate: number;        // tokens added per interval
  refillIntervalMs: number;  // how often tokens refill
}

interface Bucket {
  tokens: number;
  lastRefill: number;
}

export class RateLimiter {
  private buckets = new Map<string, Bucket>();
  private config: BucketConfig;

  constructor(config: BucketConfig) {
    this.config = config;
  }

  /**
   * Try to consume one token from the bucket for the given key.
   * Returns true if allowed, false if rate-limited.
   */
  consume(key: string): boolean {
    const now = Date.now();
    let bucket = this.buckets.get(key);

    if (!bucket) {
      // First request — initialize with full bucket
      bucket = { tokens: this.config.maxTokens, lastRefill: now };
      this.buckets.set(key, bucket);
    }

    // Refill tokens based on elapsed time
    const elapsed = now - bucket.lastRefill;
    const tokensToAdd = Math.floor(elapsed / this.config.refillIntervalMs) * this.config.refillRate;

    if (tokensToAdd > 0) {
      bucket.tokens = Math.min(this.config.maxTokens, bucket.tokens + tokensToAdd);
      bucket.lastRefill = now;
    }

    // Try to consume
    if (bucket.tokens > 0) {
      bucket.tokens -= 1;
      return true;
    }

    logger.debug('Rate limit exceeded', { key });
    return false;
  }

  /**
   * Remove a key's bucket (e.g., when player disconnects).
   */
  reset(key: string): void {
    this.buckets.delete(key);
  }

  /**
   * Periodic cleanup of stale buckets to prevent memory leaks.
   * Call this on a timer (e.g., every 60s).
   */
  cleanup(maxAgeMs: number = 300_000): void {
    const now = Date.now();
    for (const [key, bucket] of this.buckets) {
      if (now - bucket.lastRefill > maxAgeMs) {
        this.buckets.delete(key);
      }
    }
  }
}

// ── Pre-configured limiters for each event type ──

import { CONFIG } from '../config';

export const guessLimiter = new RateLimiter(CONFIG.RATE_LIMITS.guess);
export const drawLimiter = new RateLimiter(CONFIG.RATE_LIMITS.draw);
export const chatLimiter = new RateLimiter(CONFIG.RATE_LIMITS.chat);

// Cleanup stale buckets every 60 seconds
setInterval(() => {
  guessLimiter.cleanup();
  drawLimiter.cleanup();
  chatLimiter.cleanup();
}, 60_000);
