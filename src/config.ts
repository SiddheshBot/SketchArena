import dotenv from 'dotenv';
dotenv.config();

export const CONFIG = {
  PORT: parseInt(process.env.PORT || '3000', 10),
  CORS_ORIGIN: process.env.CORS_ORIGIN || 'http://localhost:5173',
  REDIS_URL: process.env.REDIS_URL || '',
  LOG_LEVEL: process.env.LOG_LEVEL || 'info',

  // Game settings
  MIN_PLAYERS: 2,
  MAX_PLAYERS: 12,
  MAX_ROUNDS: 10,
  DEFAULT_DRAW_TIME: 60,
  WORD_PICK_TIME: 15,
  ROUND_END_DELAY: 5000,        // ms to show scores between rounds
  RECONNECT_GRACE_PERIOD: 30000, // 30s grace period for reconnection
  ROOM_CLEANUP_DELAY: 60000,    // 60s before empty room is destroyed

  // Rate limiting
  RATE_LIMITS: {
    guess: { maxTokens: 5, refillRate: 5, refillIntervalMs: 1000 },
    draw:  { maxTokens: 30, refillRate: 30, refillIntervalMs: 1000 },
    chat:  { maxTokens: 3, refillRate: 3, refillIntervalMs: 1000 },
  },

  // Backpressure
  MAX_QUEUE_DEPTH: 200,
  MAX_PROCESSED_EVENTS: 1000,
} as const;
