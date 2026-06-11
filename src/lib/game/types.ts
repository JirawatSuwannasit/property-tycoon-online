import type {
  ChanceCardType,
  PlayerStatus,
  RoomStatus,
  TileType,
} from "@/lib/database.types";

export type { ChanceCardType, PlayerStatus, RoomStatus, TileType };

export type BoardTile = {
  id: string;
  tileIndex: number;
  type: TileType;
  name: string;
  description: string | null;
  price: number | null;
  rent: number | null;
  amount: number | null;
  colorGroup: string | null;
};

export type ChanceCard = {
  id: string;
  cardKey: string;
  type: ChanceCardType;
  title: string;
  description: string;
  amount: number | null;
  steps: number | null;
  targetTileIndex: number | null;
};

export type Room = {
  id: string;
  roomCode: string;
  status: RoomStatus;
  maxPlayers: number;
  hostPlayerId: string | null;
  currentTurnPlayerId: string | null;
  winnerPlayerId: string | null;
  turnNumber: number;
};

export type Player = {
  id: string;
  roomId: string;
  displayName: string;
  avatarKey: string;
  seatNo: number;
  isHost: boolean;
  isReady: boolean;
  money: number;
  position: number;
  status: PlayerStatus;
  jailTurns: number;
};

export type OwnedProperty = {
  id: string;
  roomId: string;
  tileId: string;
  ownerPlayerId: string;
  purchasedAt: string;
};

export type GameEvent = {
  id: string;
  roomId: string;
  playerId: string | null;
  eventType: string;
  message: string;
  createdAt: string;
};
