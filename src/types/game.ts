// ─── Draw Stroke (optimized payload with short keys) ───
export interface DrawStroke {
  t: 0 | 1 | 2;    // 0=start, 1=move, 2=end
  x: number;
  y: number;
  c: string;        // color hex "#rrggbb"
  w: number;        // line width
}

// ─── Game Phase State Machine ───
export type GamePhase = 'waiting' | 'picking' | 'drawing' | 'roundEnd' | 'gameOver';

// ─── Game State ───
export interface GameState {
  phase: GamePhase;
  timerEndsAt: number;   // unix ms — clients compute countdown from this
}

// ─── Room Settings ───
export interface RoomSettings {
  maxPlayers: number;      // 2-12
  totalRounds: number;     // 1-10
  drawTimeSeconds: number; // 30-120
}

// ─── Player ───
export interface Player {
  id: string;
  socketId: string;
  name: string;
  score: number;
  hasGuessedCorrectly: boolean;
  isConnected: boolean;
  disconnectedAt: number | null;
}

// ─── Room ───
export interface Room {
  id: string;
  hostId: string;
  players: Map<string, Player>;
  settings: RoomSettings;
  state: GameState;

  // Round tracking
  currentRound: number;
  currentDrawerIndex: number;
  drawOrder: string[];           // player IDs in rotation order

  // Word state
  currentWord: string | null;
  wordChoices: string[];

  // Canvas state (replay on reconnect)
  drawingStrokes: DrawStroke[];

  // Idempotency — bounded set of processed event IDs
  processedEventIds: Set<string>;

  // Timer reference for cleanup
  timerRef: ReturnType<typeof setTimeout> | null;
  cleanupTimerRef: ReturnType<typeof setTimeout> | null;
}

// ─── Serializable snapshot sent to clients ───
export interface RoomSnapshot {
  id: string;
  hostId: string;
  players: Array<Omit<Player, 'socketId'>>;
  settings: RoomSettings;
  state: GameState;
  currentRound: number;
  currentDrawerId: string | null;
  currentWordLength: number | null;
  drawingStrokes: DrawStroke[];
  yourPlayerId: string;
}

// ─── Score entry for round/game end ───
export interface ScoreEntry {
  playerId: string;
  name: string;
  score: number;
  roundScore: number;
}
