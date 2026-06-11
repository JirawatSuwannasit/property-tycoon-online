import type { PlayerStatus } from "@/lib/database.types";
import { NextResponse } from "next/server";
import { getAvatarKeyForSeat, getNextAvailableSeat } from "@/lib/server/room-lobby";
import {
  createSessionToken,
  hashSessionToken,
  isValidDisplayName,
  isValidRoomCode,
  normalizeDisplayName,
  normalizeRoomCode,
} from "@/lib/server/session";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const MAX_SEAT_ATTEMPTS = 4;

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as { displayName?: string; roomCode?: string } | null;
  const displayName = normalizeDisplayName(body?.displayName ?? "");
  const roomCode = normalizeRoomCode(body?.roomCode ?? "");

  if (!isValidDisplayName(displayName)) {
    return NextResponse.json({ error: "Player name must be 1-32 characters." }, { status: 400 });
  }

  if (!isValidRoomCode(roomCode)) {
    return NextResponse.json({ error: "Room code must be 6 uppercase letters or numbers." }, { status: 400 });
  }

  const supabase = createSupabaseAdminClient();
  const { data: room, error: roomError } = await supabase
    .from("rooms")
    .select("id, room_code, status, max_players")
    .eq("room_code", roomCode)
    .single();

  if (roomError || !room) {
    return NextResponse.json({ error: "Room not found." }, { status: 404 });
  }

  if (room.status !== "waiting") {
    return NextResponse.json({ error: "This room has already started." }, { status: 409 });
  }

  const sessionToken = createSessionToken();
  const sessionTokenHash = hashSessionToken(sessionToken);

  for (let attempt = 0; attempt < MAX_SEAT_ATTEMPTS; attempt += 1) {
    const { data: existingPlayers, error: playersError } = await supabase
      .from("players")
      .select("seat_no, status")
      .eq("room_id", room.id)
      .order("seat_no", { ascending: true });

    if (playersError || !existingPlayers) {
      return NextResponse.json({ error: playersError?.message ?? "Unable to load room seats." }, { status: 500 });
    }

    const seatPlayers = existingPlayers as { seat_no: number; status: PlayerStatus }[];
    const activePlayerCount = seatPlayers.filter((player) => player.status !== "left").length;

    if (activePlayerCount >= room.max_players) {
      return NextResponse.json({ error: "This room is full." }, { status: 409 });
    }

    const seatNo = getNextAvailableSeat(seatPlayers, room.max_players);

    if (!seatNo) {
      return NextResponse.json({ error: "This room is full." }, { status: 409 });
    }

    const { data: player, error: playerError } = await supabase
      .from("players")
      .insert({
        room_id: room.id,
        display_name: displayName,
        avatar_key: getAvatarKeyForSeat(seatNo),
        seat_no: seatNo,
        is_host: false,
        is_ready: false,
        session_token_hash: sessionTokenHash,
      })
      .select("id")
      .single();

    if (playerError) {
      if (playerError.code === "23505") {
        continue;
      }

      return NextResponse.json({ error: playerError.message }, { status: 500 });
    }

    return NextResponse.json({
      roomCode: room.room_code,
      playerId: player.id,
      sessionToken,
    });
  }

  return NextResponse.json({ error: "Unable to claim a seat. Please try again." }, { status: 409 });
}
