import { Server, Socket } from 'socket.io';
import { Room, Player, RoomSettings, RoomSnapshot } from '../types/game';
import { ServerEvent } from '../types/events';
import { generateRoomId, generatePlayerId } from '../utils/IdGenerator';
import { CONFIG } from '../config';
import { logger } from '../utils/Logger';
import { eventQueue } from '../network/EventQueue';

/**
 * RoomManager — The single source of truth for all active rooms.
 *
 * Responsibilities:
 * - Create / join / leave rooms
 * - Track player ↔ room mapping
 * - Handle disconnect / reconnect with grace period
 * - Clean up empty rooms to prevent memory leaks
 */
export class RoomManager {
  // All active rooms, keyed by room ID
  private rooms = new Map<string, Room>();

  // Reverse lookup: player ID → room ID (for quick disconnect handling)
  private playerRoomMap = new Map<string, string>();

  // Reverse lookup: socket ID → player ID
  private socketPlayerMap = new Map<string, string>();

  constructor(private io: Server) {}

  // ─── Room CRUD ───

  createRoom(socket: Socket, playerName: string, settings: RoomSettings): Room {
    const roomId = generateRoomId();
    const playerId = generatePlayerId();

    const player: Player = {
      id: playerId,
      socketId: socket.id,
      name: playerName,
      score: 0,
      hasGuessedCorrectly: false,
      isConnected: true,
      disconnectedAt: null,
    };

    const room: Room = {
      id: roomId,
      hostId: playerId,
      players: new Map([[playerId, player]]),
      settings,
      state: { phase: 'waiting', timerEndsAt: 0 },
      currentRound: 0,
      currentDrawerIndex: -1,
      drawOrder: [],
      currentWord: null,
      wordChoices: [],
      drawingStrokes: [],
      processedEventIds: new Set(),
      timerRef: null,
      cleanupTimerRef: null,
    };

    this.rooms.set(roomId, room);
    this.playerRoomMap.set(playerId, roomId);
    this.socketPlayerMap.set(socket.id, playerId);

    // Join the Socket.IO room for broadcasting
    socket.join(roomId);

    logger.info('Room created', { roomId, playerId, playerName });
    return room;
  }

  joinRoom(socket: Socket, roomId: string, playerName: string): { room: Room; player: Player } | null {
    const room = this.rooms.get(roomId);
    if (!room) return null;
    if (room.players.size >= room.settings.maxPlayers) return null;
    if (room.state.phase !== 'waiting') return null;

    const playerId = generatePlayerId();
    const player: Player = {
      id: playerId,
      socketId: socket.id,
      name: playerName,
      score: 0,
      hasGuessedCorrectly: false,
      isConnected: true,
      disconnectedAt: null,
    };

    room.players.set(playerId, player);
    this.playerRoomMap.set(playerId, roomId);
    this.socketPlayerMap.set(socket.id, playerId);

    // Cancel cleanup timer if room was about to be destroyed
    if (room.cleanupTimerRef) {
      clearTimeout(room.cleanupTimerRef);
      room.cleanupTimerRef = null;
    }

    socket.join(roomId);

    // Notify other players
    socket.to(roomId).emit(ServerEvent.PlayerJoined, {
      player: this.sanitizePlayer(player),
    });

    logger.info('Player joined room', { roomId, playerId, playerName });
    return { room, player };
  }

  // ─── Disconnect / Reconnect ───

  handleDisconnect(socketId: string): void {
    const playerId = this.socketPlayerMap.get(socketId);
    if (!playerId) return;

    const roomId = this.playerRoomMap.get(playerId);
    if (!roomId) return;

    const room = this.rooms.get(roomId);
    if (!room) return;

    const player = room.players.get(playerId);
    if (!player) return;

    // Mark as disconnected — don't remove yet (grace period)
    player.isConnected = false;
    player.disconnectedAt = Date.now();
    this.socketPlayerMap.delete(socketId);

    logger.info('Player disconnected (grace period started)', { roomId, playerId });

    // Notify other players
    this.io.to(roomId).emit(ServerEvent.PlayerLeft, { playerId, temporary: true });

    // Start grace period timer
    setTimeout(() => {
      // If still disconnected after grace period, remove permanently
      if (!player.isConnected) {
        this.removePlayer(roomId, playerId);
      }
    }, CONFIG.RECONNECT_GRACE_PERIOD);
  }

  handleReconnect(socket: Socket, playerId: string, roomId: string): Room | null {
    const room = this.rooms.get(roomId);
    if (!room) return null;

    const player = room.players.get(playerId);
    if (!player) return null;
    if (player.isConnected) return null; // Already connected

    // Check grace period
    if (
      player.disconnectedAt &&
      Date.now() - player.disconnectedAt > CONFIG.RECONNECT_GRACE_PERIOD
    ) {
      return null; // Too late
    }

    // Restore connection
    player.isConnected = true;
    player.socketId = socket.id;
    player.disconnectedAt = null;
    this.socketPlayerMap.set(socket.id, playerId);
    this.playerRoomMap.set(playerId, roomId);

    socket.join(roomId);

    logger.info('Player reconnected', { roomId, playerId });

    // Notify others
    socket.to(roomId).emit(ServerEvent.PlayerJoined, {
      player: this.sanitizePlayer(player),
      reconnected: true,
    });

    return room;
  }

  private removePlayer(roomId: string, playerId: string): void {
    const room = this.rooms.get(roomId);
    if (!room) return;

    room.players.delete(playerId);
    this.playerRoomMap.delete(playerId);

    this.io.to(roomId).emit(ServerEvent.PlayerLeft, { playerId, temporary: false });

    logger.info('Player removed permanently', { roomId, playerId });

    // If host left, assign new host
    if (room.hostId === playerId && room.players.size > 0) {
      const newHost = room.players.values().next().value as Player;
      room.hostId = newHost.id;
    }

    // If room is empty, schedule cleanup
    if (room.players.size === 0) {
      this.scheduleCleanup(roomId);
    }
  }

  leaveRoom(socketId: string): void {
    const playerId = this.socketPlayerMap.get(socketId);
    if (!playerId) return;

    const roomId = this.playerRoomMap.get(playerId);
    if (!roomId) return;

    this.socketPlayerMap.delete(socketId);
    this.removePlayer(roomId, playerId);
  }

  private scheduleCleanup(roomId: string): void {
    const room = this.rooms.get(roomId);
    if (!room) return;

    room.cleanupTimerRef = setTimeout(() => {
      if (room.players.size === 0) {
        this.rooms.delete(roomId);
        eventQueue.removeRoom(roomId);
        logger.info('Room destroyed (empty)', { roomId });
      }
    }, CONFIG.ROOM_CLEANUP_DELAY);
  }

  // ─── Lookups ───

  getRoom(roomId: string): Room | undefined {
    return this.rooms.get(roomId);
  }

  getRoomBySocketId(socketId: string): { room: Room; player: Player } | null {
    const playerId = this.socketPlayerMap.get(socketId);
    if (!playerId) return null;

    const roomId = this.playerRoomMap.get(playerId);
    if (!roomId) return null;

    const room = this.rooms.get(roomId);
    if (!room) return null;

    const player = room.players.get(playerId);
    if (!player) return null;

    return { room, player };
  }

  getPlayerId(socketId: string): string | undefined {
    return this.socketPlayerMap.get(socketId);
  }

  // ─── Snapshot (for sending to clients) ───

  createSnapshot(room: Room, forPlayerId: string): RoomSnapshot {
    const currentDrawerId = room.drawOrder[room.currentDrawerIndex] || null;

    return {
      id: room.id,
      hostId: room.hostId,
      players: Array.from(room.players.values()).map(p => this.sanitizePlayer(p)),
      settings: room.settings,
      state: room.state,
      currentRound: room.currentRound,
      currentDrawerId,
      currentWordLength: room.currentWord ? room.currentWord.length : null,
      drawingStrokes: room.drawingStrokes,
      yourPlayerId: forPlayerId,
    };
  }

  private sanitizePlayer(player: Player): Omit<Player, 'socketId'> {
    const { socketId, ...safe } = player;
    return safe;
  }

  // ─── Connected players count (for game logic) ───

  getConnectedPlayers(room: Room): Player[] {
    return Array.from(room.players.values()).filter(p => p.isConnected);
  }
}
