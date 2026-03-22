import { DrawStrokePayload, CreateRoomPayload, JoinRoomPayload, GuessPayload } from '../types/events';

/**
 * Server-side input validation.
 *
 * Golden rule: NEVER trust client input.
 * Every field is validated for type, range, and content before processing.
 */

const HEX_COLOR_REGEX = /^#[0-9a-fA-F]{6}$/;
const SAFE_TEXT_REGEX = /^[a-zA-Z0-9\s\-']+$/;

export function validatePlayerName(name: unknown): name is string {
  return (
    typeof name === 'string' &&
    name.length >= 2 &&
    name.length <= 16 &&
    SAFE_TEXT_REGEX.test(name)
  );
}

export function validateRoomSettings(settings: unknown): settings is CreateRoomPayload['settings'] {
  if (!settings || typeof settings !== 'object') return false;
  const s = settings as Record<string, unknown>;
  return (
    typeof s.maxPlayers === 'number' && s.maxPlayers >= 2 && s.maxPlayers <= 12 &&
    typeof s.totalRounds === 'number' && s.totalRounds >= 1 && s.totalRounds <= 10 &&
    typeof s.drawTimeSeconds === 'number' && s.drawTimeSeconds >= 30 && s.drawTimeSeconds <= 120
  );
}

export function validateStroke(payload: unknown): payload is DrawStrokePayload {
  if (!payload || typeof payload !== 'object') return false;
  const p = payload as Record<string, unknown>;

  if (typeof p.eventId !== 'string' || p.eventId.length === 0) return false;

  const stroke = p.stroke as Record<string, unknown> | undefined;
  if (!stroke || typeof stroke !== 'object') return false;

  return (
    (stroke.t === 0 || stroke.t === 1 || stroke.t === 2) &&
    typeof stroke.x === 'number' && stroke.x >= 0 && stroke.x <= 800 &&
    typeof stroke.y === 'number' && stroke.y >= 0 && stroke.y <= 600 &&
    typeof stroke.c === 'string' && HEX_COLOR_REGEX.test(stroke.c) &&
    typeof stroke.w === 'number' && stroke.w >= 1 && stroke.w <= 40
  );
}

export function validateGuess(payload: unknown): payload is GuessPayload {
  if (!payload || typeof payload !== 'object') return false;
  const p = payload as Record<string, unknown>;

  return (
    typeof p.eventId === 'string' && p.eventId.length > 0 &&
    typeof p.text === 'string' &&
    p.text.length >= 1 &&
    p.text.length <= 50
  );
}

export function validateJoinRoom(payload: unknown): payload is JoinRoomPayload {
  if (!payload || typeof payload !== 'object') return false;
  const p = payload as Record<string, unknown>;

  return (
    typeof p.roomId === 'string' && p.roomId.length > 0 &&
    typeof p.playerName === 'string' && validatePlayerName(p.playerName)
  );
}
