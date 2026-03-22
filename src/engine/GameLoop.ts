import { Server } from 'socket.io';
import { Room, Player, ScoreEntry } from '../types/game';
import { ServerEvent } from '../types/events';
import { RoomManager } from './RoomManager';
import { getWordChoices } from './WordBank';
import { calculateGuesserScore, calculateDrawerScore } from './Scoring';
import { GameTimer } from '../utils/Timer';
import { CONFIG } from '../config';
import { logger } from '../utils/Logger';

/**
 * GameLoop — State machine driving the game flow.
 *
 * Phase transitions:
 *   waiting ──(host starts)──► picking ──(drawer picks word)──► drawing
 *      ▲                                                          │
 *      │                                                          ▼
 *   gameOver ◄──(all rounds done)── roundEnd ◄──(timer or all guessed)
 *
 * All mutations are called from the EventQueue, so they're
 * guaranteed to run serially per room — no race conditions.
 */
export class GameLoop {
  // One timer per room
  private timers = new Map<string, GameTimer>();

  constructor(private io: Server, private roomManager: RoomManager) {}

  // ─── Get or create timer for a room ───

  private getTimer(roomId: string): GameTimer {
    let timer = this.timers.get(roomId);
    if (!timer) {
      timer = new GameTimer();
      this.timers.set(roomId, timer);
    }
    return timer;
  }

  // ─── START GAME ───

  startGame(room: Room): void {
    const connectedPlayers = this.roomManager.getConnectedPlayers(room);

    if (connectedPlayers.length < CONFIG.MIN_PLAYERS) {
      logger.warn('Not enough players to start', { roomId: room.id });
      return;
    }

    // Shuffle player order for drawing rotation
    room.drawOrder = connectedPlayers.map(p => p.id);
    this.shuffleArray(room.drawOrder);

    room.currentRound = 1;
    room.currentDrawerIndex = -1; // Will be incremented to 0 in nextTurn

    logger.info('Game started', { roomId: room.id, players: room.drawOrder.length });

    this.nextTurn(room);
  }

  // ─── NEXT TURN (advance to next drawer) ───

  private nextTurn(room: Room): void {
    room.currentDrawerIndex++;

    // If all players have drawn, advance to next round
    if (room.currentDrawerIndex >= room.drawOrder.length) {
      room.currentDrawerIndex = 0;
      room.currentRound++;

      if (room.currentRound > room.settings.totalRounds) {
        this.endGame(room);
        return;
      }
    }

    // Reset per-turn state
    room.currentWord = null;
    room.drawingStrokes = [];
    for (const player of room.players.values()) {
      player.hasGuessedCorrectly = false;
    }

    // Generate word choices for the drawer
    room.wordChoices = getWordChoices();
    const drawerId = room.drawOrder[room.currentDrawerIndex];
    const drawer = room.players.get(drawerId);

    if (!drawer || !drawer.isConnected) {
      // Skip disconnected drawer
      logger.info('Skipping disconnected drawer', { roomId: room.id, drawerId });
      this.nextTurn(room);
      return;
    }

    // Transition to PICKING phase
    const timer = this.getTimer(room.id);
    const endsAt = timer.start(CONFIG.WORD_PICK_TIME * 1000, () => {
      // Auto-pick first word if drawer doesn't choose in time
      this.pickWord(room, room.wordChoices[0]);
    });

    room.state = { phase: 'picking', timerEndsAt: endsAt };

    // Send word choices ONLY to the drawer
    const drawerSocket = this.io.sockets.sockets.get(drawer.socketId);
    if (drawerSocket) {
      drawerSocket.emit(ServerEvent.WordChoices, { words: room.wordChoices });
    }

    // Tell everyone: new turn, picking phase
    this.io.to(room.id).emit(ServerEvent.PhaseChange, {
      phase: 'picking',
      timerEndsAt: endsAt,
      drawerId,
      round: room.currentRound,
    });

    logger.info('Picking phase started', { roomId: room.id, drawerId });
  }

  // ─── PICK WORD ───

  pickWord(room: Room, word: string): void {
    // Validate the picked word is one of the choices
    if (!room.wordChoices.includes(word)) {
      logger.warn('Invalid word pick', { roomId: room.id, word });
      return;
    }

    room.currentWord = word.toLowerCase();

    // Transition to DRAWING phase
    const timer = this.getTimer(room.id);
    const drawTimeMs = room.settings.drawTimeSeconds * 1000;
    const endsAt = timer.start(drawTimeMs, () => {
      this.endRound(room);
    });

    room.state = { phase: 'drawing', timerEndsAt: endsAt };

    const drawerId = room.drawOrder[room.currentDrawerIndex];

    // Broadcast phase change — send word LENGTH (not the word!) to guessers
    this.io.to(room.id).emit(ServerEvent.PhaseChange, {
      phase: 'drawing',
      timerEndsAt: endsAt,
      drawerId,
      wordLength: room.currentWord.length,
      round: room.currentRound,
    });

    logger.info('Drawing phase started', {
      roomId: room.id,
      word: room.currentWord,
      drawTimeMs,
    });
  }

  // ─── HANDLE GUESS ───

  handleGuess(room: Room, playerId: string, guess: string): void {
    if (room.state.phase !== 'drawing' || !room.currentWord) return;

    const player = room.players.get(playerId);
    if (!player) return;

    const drawerId = room.drawOrder[room.currentDrawerIndex];

    // Drawer cannot guess
    if (playerId === drawerId) return;

    // Already guessed correctly — ignore
    if (player.hasGuessedCorrectly) return;

    const normalizedGuess = guess.trim().toLowerCase();
    const normalizedWord = room.currentWord.toLowerCase();

    // ── Correct guess ──
    if (normalizedGuess === normalizedWord) {
      player.hasGuessedCorrectly = true;

      // Time-based scoring
      const timer = this.getTimer(room.id);
      const totalTimeMs = room.settings.drawTimeSeconds * 1000;
      const remainingMs = timer.remaining();
      const guessScore = calculateGuesserScore(remainingMs, totalTimeMs);
      player.score += guessScore;

      // Drawer bonus
      const drawer = room.players.get(drawerId);
      const drawerBonus = calculateDrawerScore(1);
      if (drawer) drawer.score += drawerBonus;

      this.io.to(room.id).emit(ServerEvent.GuessCorrect, {
        playerId,
        playerName: player.name,
        score: guessScore,
      });

      logger.info('Correct guess', { roomId: room.id, playerId, guessScore });

      // Check if all guessers have guessed correctly
      if (this.allGuessed(room)) {
        this.endRound(room);
      }

      return;
    }

    // ── Close guess (e.g., off by 1-2 characters) ──
    if (this.isCloseGuess(normalizedGuess, normalizedWord)) {
      // Only tell the guesser privately — don't reveal to others
      const playerSocket = this.io.sockets.sockets.get(player.socketId);
      if (playerSocket) {
        playerSocket.emit(ServerEvent.GuessClose, { playerId });
      }
      return;
    }

    // ── Wrong guess — broadcast as chat message ──
    this.io.to(room.id).emit(ServerEvent.GuessWrong, {
      playerId,
      playerName: player.name,
      text: guess,
    });
  }

  // ─── END ROUND ───

  private endRound(room: Room): void {
    const timer = this.getTimer(room.id);
    timer.clear();

    room.state = { phase: 'roundEnd', timerEndsAt: Date.now() + CONFIG.ROUND_END_DELAY };

    const scores: ScoreEntry[] = Array.from(room.players.values()).map(p => ({
      playerId: p.id,
      name: p.name,
      score: p.score,
      roundScore: p.hasGuessedCorrectly ? calculateGuesserScore(timer.remaining(), room.settings.drawTimeSeconds * 1000) : 0,
    }));

    this.io.to(room.id).emit(ServerEvent.RoundEnd, {
      word: room.currentWord,
      scores,
    });

    logger.info('Round ended', { roomId: room.id, word: room.currentWord });

    // After delay, move to next turn
    room.timerRef = setTimeout(() => {
      this.nextTurn(room);
    }, CONFIG.ROUND_END_DELAY);
  }

  // ─── END GAME ───

  private endGame(room: Room): void {
    const timer = this.getTimer(room.id);
    timer.clear();

    room.state = { phase: 'gameOver', timerEndsAt: 0 };

    const finalScores: ScoreEntry[] = Array.from(room.players.values())
      .map(p => ({
        playerId: p.id,
        name: p.name,
        score: p.score,
        roundScore: 0,
      }))
      .sort((a, b) => b.score - a.score);

    const winnerId = finalScores[0]?.playerId || null;

    this.io.to(room.id).emit(ServerEvent.GameOver, { finalScores, winnerId });

    // Clean up timer
    this.timers.delete(room.id);

    // Reset room to waiting so players can play again
    room.currentRound = 0;
    room.currentDrawerIndex = -1;
    room.drawOrder = [];
    room.currentWord = null;
    room.drawingStrokes = [];
    room.processedEventIds.clear();

    // Reset player scores
    for (const player of room.players.values()) {
      player.score = 0;
      player.hasGuessedCorrectly = false;
    }

    room.state = { phase: 'waiting', timerEndsAt: 0 };

    logger.info('Game over', { roomId: room.id, winnerId });
  }

  // ─── DRAW EVENT HANDLING ───

  handleDraw(room: Room, playerId: string, stroke: Room['drawingStrokes'][0]): void {
    if (room.state.phase !== 'drawing') return;

    const drawerId = room.drawOrder[room.currentDrawerIndex];
    if (playerId !== drawerId) return; // Only drawer can draw

    // Store stroke (for reconnecting players)
    room.drawingStrokes.push(stroke);

    // Broadcast to all OTHER players in the room
    const drawer = room.players.get(drawerId);
    if (drawer) {
      const drawerSocket = this.io.sockets.sockets.get(drawer.socketId);
      if (drawerSocket) {
        drawerSocket.to(room.id).emit(ServerEvent.DrawStroke, { stroke });
      }
    }
  }

  handleClear(room: Room, playerId: string): void {
    if (room.state.phase !== 'drawing') return;

    const drawerId = room.drawOrder[room.currentDrawerIndex];
    if (playerId !== drawerId) return;

    room.drawingStrokes = [];

    const drawer = room.players.get(drawerId);
    if (drawer) {
      const drawerSocket = this.io.sockets.sockets.get(drawer.socketId);
      if (drawerSocket) {
        drawerSocket.to(room.id).emit(ServerEvent.DrawClear, {});
      }
    }
  }

  // ─── Helpers ───

  private allGuessed(room: Room): boolean {
    const drawerId = room.drawOrder[room.currentDrawerIndex];
    for (const player of room.players.values()) {
      if (player.id === drawerId) continue;
      if (!player.isConnected) continue;
      if (!player.hasGuessedCorrectly) return false;
    }
    return true;
  }

  /**
   * Levenshtein distance check — a guess is "close" if it's
   * within 1-2 edits of the answer. Shows "almost there!" hint.
   */
  private isCloseGuess(guess: string, answer: string): boolean {
    if (guess.length === 0 || answer.length === 0) return false;
    const distance = this.levenshtein(guess, answer);
    return distance > 0 && distance <= 2;
  }

  private levenshtein(a: string, b: string): number {
    const matrix: number[][] = [];

    for (let i = 0; i <= b.length; i++) matrix[i] = [i];
    for (let j = 0; j <= a.length; j++) matrix[0][j] = j;

    for (let i = 1; i <= b.length; i++) {
      for (let j = 1; j <= a.length; j++) {
        const cost = b[i - 1] === a[j - 1] ? 0 : 1;
        matrix[i][j] = Math.min(
          matrix[i - 1][j] + 1,       // deletion
          matrix[i][j - 1] + 1,       // insertion
          matrix[i - 1][j - 1] + cost  // substitution
        );
      }
    }

    return matrix[b.length][a.length];
  }

  private shuffleArray(arr: string[]): void {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
  }

  // ─── Cleanup (when room is destroyed) ───

  cleanup(roomId: string): void {
    const timer = this.timers.get(roomId);
    if (timer) {
      timer.clear();
      this.timers.delete(roomId);
    }
  }
}
