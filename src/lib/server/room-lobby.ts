import type { Database } from "@/lib/database.types";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { hashSessionToken, isValidRoomCode, normalizeRoomCode } from "./session";

type RoomRow = Database["public"]["Tables"]["rooms"]["Row"];
type PlayerRow = Database["public"]["Tables"]["players"]["Row"];

type PublicPlayer = Pick<
  PlayerRow,
  | "id"
  | "display_name"
  | "avatar_key"
  | "seat_no"
  | "is_host"
  | "is_ready"
  | "money"
  | "position"
  | "status"
  | "turn_order_card"
  | "play_order"
  | "created_at"
>;

export type LobbyState = {
  room: Pick<
    RoomRow,
    | "id"
    | "room_code"
    | "status"
    | "max_players"
    | "host_player_id"
    | "current_turn_player_id"
    | "winner_player_id"
    | "turn_number"
    | "turn_phase"
    | "action_deadline_at"
    | "created_at"
    | "updated_at"
  >;
  players: PublicPlayer[];
  currentPlayer: PublicPlayer | null;
  canStartGame: boolean;
  startRequirements: {
    isWaiting: boolean;
    hasEnoughPlayers: boolean;
    hasRoomCapacity: boolean;
    allNonHostsReady: boolean;
  };
};

export function getAvatarKeyForSeat(seatNo: number) {
  return ["berry_blob", "cloud_cat", "star_sprout", "mint_robot"][seatNo - 1] ?? "pixel_pal";
}

export function getNextAvailableSeat(players: Pick<PlayerRow, "seat_no" | "status">[], maxPlayers: number) {
  const occupiedSeats = new Set(players.filter((player) => player.status !== "left").map((player) => player.seat_no));

  for (let seatNo = 1; seatNo <= maxPlayers; seatNo += 1) {
    if (!occupiedSeats.has(seatNo)) {
      return seatNo;
    }
  }

  return null;
}

export function getStartRequirements(room: Pick<RoomRow, "status" | "max_players">, players: PublicPlayer[]) {
  const activePlayers = players.filter((player) => player.status !== "left");
  const nonHostPlayers = activePlayers.filter((player) => !player.is_host);
  const isWaiting = room.status === "waiting";
  const hasEnoughPlayers = activePlayers.length >= 2;
  const hasRoomCapacity = activePlayers.length <= room.max_players && activePlayers.length <= 4;
  const allNonHostsReady = nonHostPlayers.length > 0 && nonHostPlayers.every((player) => player.is_ready);

  return {
    isWaiting,
    hasEnoughPlayers,
    hasRoomCapacity,
    allNonHostsReady,
  };
}

export function canStartRoom(room: Pick<RoomRow, "status" | "max_players">, players: PublicPlayer[]) {
  const requirements = getStartRequirements(room, players);

  return Object.values(requirements).every(Boolean);
}

export async function getLobbyState(
  roomCode: string,
  session?: { playerId?: string | null; sessionToken?: string | null },
): Promise<LobbyState | null> {
  const normalizedRoomCode = normalizeRoomCode(roomCode);

  if (!isValidRoomCode(normalizedRoomCode)) {
    return null;
  }

  const supabase = createSupabaseAdminClient();
  const { data: room, error: roomError } = await supabase
    .from("rooms")
    .select(
      "id, room_code, status, max_players, host_player_id, current_turn_player_id, winner_player_id, turn_number, turn_phase, action_deadline_at, created_at, updated_at",
    )
    .eq("room_code", normalizedRoomCode)
    .single();

  if (roomError) {
    if (roomError.code === "PGRST116") {
      return null;
    }

    console.error("Failed to load lobby room", roomError);
    throw new Error(roomError.message);
  }

  if (!room) {
    return null;
  }

  const { data: players, error: playersError } = await supabase
    .from("players")
    .select("id, display_name, avatar_key, seat_no, is_host, is_ready, money, position, status, turn_order_card, play_order, created_at")
    .eq("room_id", room.id)
    .order("seat_no", { ascending: true });

  if (playersError || !players) {
    throw new Error(playersError?.message ?? "Unable to load players");
  }

  let currentPlayer: PublicPlayer | null = null;

  if (session?.playerId && session.sessionToken) {
    const tokenHash = hashSessionToken(session.sessionToken);
    const { data: verifiedPlayer, error: verifiedPlayerError } = await supabase
      .from("players")
      .select("id, display_name, avatar_key, seat_no, is_host, is_ready, money, position, status, turn_order_card, play_order, created_at")
      .eq("room_id", room.id)
      .eq("id", session.playerId)
      .eq("session_token_hash", tokenHash)
      .maybeSingle();

    if (verifiedPlayerError) {
      console.error("Failed to verify lobby player session", verifiedPlayerError);
      throw new Error(verifiedPlayerError.message);
    }

    currentPlayer = (verifiedPlayer as PublicPlayer | null) ?? null;
  }

  const publicRoom = room as LobbyState["room"];
  const publicPlayers = (players as PublicPlayer[]).sort((a, b) => {
    if (publicRoom.status === "playing") {
      return (a.play_order ?? 99) - (b.play_order ?? 99) || a.seat_no - b.seat_no;
    }

    return a.seat_no - b.seat_no;
  });
  const startRequirements = getStartRequirements(publicRoom, publicPlayers);

  return {
    room: publicRoom,
    players: publicPlayers,
    currentPlayer,
    canStartGame: Object.values(startRequirements).every(Boolean),
    startRequirements,
  };
}

export async function validatePlayerSession(roomCode: string, playerId: string, sessionToken: string) {
  const lobbyState = await getLobbyState(roomCode, { playerId, sessionToken });

  if (!lobbyState || !lobbyState.currentPlayer) {
    return null;
  }

  return {
    lobbyState,
    player: lobbyState.currentPlayer,
  };
}
