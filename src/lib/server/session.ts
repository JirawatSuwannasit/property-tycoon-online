import { createHash, randomBytes, randomInt } from "crypto";

const ROOM_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function createSessionToken() {
  return randomBytes(32).toString("base64url");
}

export function hashSessionToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export function createRoomCode() {
  return Array.from({ length: 6 }, () => ROOM_CODE_ALPHABET[randomInt(ROOM_CODE_ALPHABET.length)]).join("");
}

export function normalizeRoomCode(roomCode: string) {
  return roomCode.trim().toUpperCase();
}

export function isValidRoomCode(roomCode: string) {
  return /^[A-Z0-9]{6}$/.test(roomCode);
}

export function normalizeDisplayName(displayName: string) {
  return displayName.trim().replace(/\s+/g, " ");
}

export function isValidDisplayName(displayName: string) {
  const normalized = normalizeDisplayName(displayName);
  return normalized.length >= 1 && normalized.length <= 32;
}
