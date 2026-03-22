import { nanoid, customAlphabet } from 'nanoid';

// Room IDs: 6 uppercase alphanumeric characters (easy to share/type)
const roomIdGenerator = customAlphabet('ABCDEFGHJKLMNPQRSTUVWXYZ23456789', 6);

// Player IDs: 12 character unique IDs
const playerIdGenerator = customAlphabet('abcdefghijklmnopqrstuvwxyz0123456789', 12);

// Event IDs: standard nanoid
export function generateRoomId(): string {
  return roomIdGenerator();
}

export function generatePlayerId(): string {
  return playerIdGenerator();
}

export function generateEventId(): string {
  return nanoid();
}
