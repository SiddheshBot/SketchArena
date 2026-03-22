import { Server, Socket } from 'socket.io';
import { ClientEvent, ServerEvent } from '../types/events';
import {
  CreateRoomPayload,
  JoinRoomPayload,
  PickWordPayload,
  DrawStrokePayload,
  DrawClearPayload,
  GuessPayload,
  ReconnectPayload,
} from '../types/events';
import { RoomManager } from '../engine/RoomManager';
import { GameLoop } from '../engine/GameLoop';
import { eventQueue } from './EventQueue';
import { guessLimiter, drawLimiter } from '../middleware/RateLimiter';
import {
  validatePlayerName,
  validateRoomSettings,
  validateStroke,
  validateGuess,
  validateJoinRoom,
} from '../middleware/Validator';
import { CONFIG } from '../config';
import { logger } from '../utils/Logger';

/**
 * SocketHandlers — Wires up all WebSocket event listeners.
 *
 * Every handler follows the pipeline:
 *   1. Rate-limit check
 *   2. Input validation (never trust client)
 *   3. Enqueue to per-room event queue (serialized processing)
 *   4. Call game engine
 *   5. Broadcast result
 *
 * Idempotency: Mutating events include an `eventId`. The server
 * deduplicates using a bounded Set on the room to prevent
 * duplicate scoring from retried network requests.
 */
export function registerSocketHandlers(
  io: Server,
  roomManager: RoomManager,
  gameLoop: GameLoop
): void {
  io.on('connection', (socket: Socket) => {
    logger.info('Client connected', { socketId: socket.id });

    // ─── CREATE ROOM ───
    socket.on(ClientEvent.RoomCreate, (payload: CreateRoomPayload) => {
      if (!validatePlayerName(payload?.playerName)) {
        socket.emit(ServerEvent.Error, { code: 'INVALID_NAME', message: 'Invalid player name (2-16 chars, alphanumeric)' });
        return;
      }
      if (!validateRoomSettings(payload?.settings)) {
        socket.emit(ServerEvent.Error, { code: 'INVALID_SETTINGS', message: 'Invalid room settings' });
        return;
      }

      const room = roomManager.createRoom(socket, payload.playerName, payload.settings);
      const playerId = roomManager.getPlayerId(socket.id)!;
      const snapshot = roomManager.createSnapshot(room, playerId);
      socket.emit(ServerEvent.RoomState, snapshot);
    });

    // ─── JOIN ROOM ───
    socket.on(ClientEvent.RoomJoin, (payload: JoinRoomPayload) => {
      if (!validateJoinRoom(payload)) {
        socket.emit(ServerEvent.Error, { code: 'INVALID_INPUT', message: 'Invalid join payload' });
        return;
      }

      const result = roomManager.joinRoom(socket, payload.roomId, payload.playerName);
      if (!result) {
        socket.emit(ServerEvent.Error, { code: 'JOIN_FAILED', message: 'Room not found, full, or game in progress' });
        return;
      }

      const snapshot = roomManager.createSnapshot(result.room, result.player.id);
      socket.emit(ServerEvent.RoomState, snapshot);
    });

    // ─── LEAVE ROOM ───
    socket.on(ClientEvent.RoomLeave, () => {
      roomManager.leaveRoom(socket.id);
    });

    // ─── START GAME ───
    socket.on(ClientEvent.GameStart, () => {
      const ctx = roomManager.getRoomBySocketId(socket.id);
      if (!ctx) return;

      // Only host can start
      if (ctx.player.id !== ctx.room.hostId) {
        socket.emit(ServerEvent.Error, { code: 'NOT_HOST', message: 'Only the host can start the game' });
        return;
      }

      if (ctx.room.state.phase !== 'waiting') {
        socket.emit(ServerEvent.Error, { code: 'GAME_ACTIVE', message: 'Game already in progress' });
        return;
      }

      eventQueue.enqueue(ctx.room.id, async () => {
        gameLoop.startGame(ctx.room);
      });
    });

    // ─── PICK WORD ───
    socket.on(ClientEvent.GamePickWord, (payload: PickWordPayload) => {
      const ctx = roomManager.getRoomBySocketId(socket.id);
      if (!ctx) return;

      if (ctx.room.state.phase !== 'picking') return;

      // Only the current drawer can pick
      const drawerId = ctx.room.drawOrder[ctx.room.currentDrawerIndex];
      if (ctx.player.id !== drawerId) return;

      if (typeof payload?.word !== 'string') return;

      eventQueue.enqueue(ctx.room.id, async () => {
        gameLoop.pickWord(ctx.room, payload.word);
      });
    });

    // ─── DRAW STROKE ───
    socket.on(ClientEvent.DrawStroke, (payload: DrawStrokePayload) => {
      const ctx = roomManager.getRoomBySocketId(socket.id);
      if (!ctx) return;

      // Rate limit draw events
      if (!drawLimiter.consume(ctx.player.id)) return;

      // Validate stroke data
      if (!validateStroke(payload)) return;

      // Idempotency check
      if (ctx.room.processedEventIds.has(payload.eventId)) return;
      ctx.room.processedEventIds.add(payload.eventId);
      trimProcessedEvents(ctx.room.processedEventIds);

      // Draw events are high-frequency — process inline (not queued)
      // since they don't mutate scoring state
      gameLoop.handleDraw(ctx.room, ctx.player.id, payload.stroke);
    });

    // ─── DRAW CLEAR ───
    socket.on(ClientEvent.DrawClear, (payload: DrawClearPayload) => {
      const ctx = roomManager.getRoomBySocketId(socket.id);
      if (!ctx) return;

      if (typeof payload?.eventId !== 'string') return;
      if (ctx.room.processedEventIds.has(payload.eventId)) return;
      ctx.room.processedEventIds.add(payload.eventId);

      gameLoop.handleClear(ctx.room, ctx.player.id);
    });

    // ─── GUESS ───
    socket.on(ClientEvent.GuessSubmit, (payload: GuessPayload) => {
      const ctx = roomManager.getRoomBySocketId(socket.id);
      if (!ctx) return;

      // Rate limit
      if (!guessLimiter.consume(ctx.player.id)) {
        socket.emit(ServerEvent.Error, { code: 'RATE_LIMITED', message: 'Slow down! Too many guesses.' });
        return;
      }

      // Validate
      if (!validateGuess(payload)) {
        socket.emit(ServerEvent.Error, { code: 'INVALID_GUESS', message: 'Invalid guess format' });
        return;
      }

      // Idempotency check — prevent duplicate scoring
      if (ctx.room.processedEventIds.has(payload.eventId)) return;
      ctx.room.processedEventIds.add(payload.eventId);
      trimProcessedEvents(ctx.room.processedEventIds);

      // Enqueue — this is a state-mutating event, must be serialized
      eventQueue.enqueue(ctx.room.id, async () => {
        gameLoop.handleGuess(ctx.room, ctx.player.id, payload.text);
      });
    });

    // ─── RECONNECT ───
    socket.on(ClientEvent.Reconnect, (payload: ReconnectPayload) => {
      if (typeof payload?.playerId !== 'string' || typeof payload?.roomId !== 'string') {
        socket.emit(ServerEvent.Error, { code: 'INVALID_INPUT', message: 'Invalid reconnect payload' });
        return;
      }

      const room = roomManager.handleReconnect(socket, payload.playerId, payload.roomId);
      if (!room) {
        socket.emit(ServerEvent.Error, { code: 'RECONNECT_FAILED', message: 'Reconnection failed — session expired or room not found' });
        return;
      }

      // Send full state snapshot so client can restore
      const snapshot = roomManager.createSnapshot(room, payload.playerId);
      socket.emit(ServerEvent.RoomState, snapshot);
    });

    // ─── DISCONNECT ───
    socket.on('disconnect', () => {
      logger.info('Client disconnected', { socketId: socket.id });
      roomManager.handleDisconnect(socket.id);
    });
  });
}

/**
 * Trim processed event IDs to prevent unbounded memory growth.
 * Keeps the set to at most MAX_PROCESSED_EVENTS.
 * Eviction is FIFO based on insertion order (Set preserves insertion order).
 */
function trimProcessedEvents(set: Set<string>): void {
  if (set.size > CONFIG.MAX_PROCESSED_EVENTS) {
    const excess = set.size - CONFIG.MAX_PROCESSED_EVENTS;
    let count = 0;
    for (const id of set) {
      if (count >= excess) break;
      set.delete(id);
      count++;
    }
  }
}
