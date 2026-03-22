/**
 * Scoring System
 *
 * Time-based scoring encourages fast guessing and clear drawing.
 *
 * Guesser score: Faster guesses earn more points.
 *   Formula: max(100, floor(500 × (timeRemaining / totalTime)))
 *   - First correct guess ≈ 500 points
 *   - Last second guess ≈ 100 points
 *
 * Drawer score: +50 per correct guesser (incentivizes clear drawing)
 */

export function calculateGuesserScore(timeRemainingMs: number, totalTimeMs: number): number {
  if (totalTimeMs <= 0) return 100;
  const ratio = Math.max(0, Math.min(1, timeRemainingMs / totalTimeMs));
  return Math.max(100, Math.floor(500 * ratio));
}

export function calculateDrawerScore(correctGuessCount: number): number {
  return correctGuessCount * 50;
}
