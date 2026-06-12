import { NextResponse } from "next/server";
import type { Json } from "@/lib/database.types";
import { createSessionToken, createRoomCode, hashSessionToken, isValidDisplayName, normalizeDisplayName } from "@/lib/server/session";
import { getAvatarKeyForSeat } from "@/lib/server/room-lobby";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const MAX_ROOM_CODE_ATTEMPTS = 8;

type CreateRoomBody = {
  displayName?: string;
};

function jsonError(error: unknown, fallbackMessage: string, status = 500) {
  return NextResponse.json(
    { error: error instanceof Error ? error.message : fallbackMessage },
    { status },
  );
}

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => null)) as CreateRoomBody | null;
    const displayName = normalizeDisplayName(body?.displayName ?? "");

    if (!isValidDisplayName(displayName)) {
      return NextResponse.json({ error: "Player name must be 1-32 characters." }, { status: 400 });
    }

    const supabase = createSupabaseAdminClient();
    const sessionToken = createSessionToken();
    const sessionTokenHash = hashSessionToken(sessionToken);

    for (let attempt = 0; attempt < MAX_ROOM_CODE_ATTEMPTS; attempt += 1) {
      const roomCode = createRoomCode();
      const { data: room, error: roomError } = await supabase
        .from("rooms")
        .insert({ room_code: roomCode, status: "waiting", max_players: 4 })
        .select("id, room_code, status, max_players, turn_number, created_at")
        .single();

      if (roomError) {
        if (roomError.code === "23505") {
          continue;
        }

        console.error("Failed to create room", roomError);
        return NextResponse.json({ error: roomError.message }, { status: 500 });
      }

      const { data: player, error: playerError } = await supabase
        .from("players")
        .insert({
          room_id: room.id,
          display_name: displayName,
          avatar_key: getAvatarKeyForSeat(1),
          seat_no: 1,
          is_host: true,
          is_ready: true,
          session_token_hash: sessionTokenHash,
        })
        .select("id, display_name, seat_no, is_host, is_ready, status")
        .single();

      if (playerError) {
        console.error("Failed to create host player", playerError);
        await supabase.from("rooms").delete().eq("id", room.id);
        return NextResponse.json({ error: playerError.message }, { status: 500 });
      }

      const { error: updateError } = await supabase
        .from("rooms")
        .update({ host_player_id: player.id })
        .eq("id", room.id);

      if (updateError) {
        console.error("Failed to assign room host", updateError);
        await supabase.from("rooms").delete().eq("id", room.id);
        return NextResponse.json({ error: updateError.message }, { status: 500 });
      }

      const initialState: Json = {
        phase: "lobby",
        roomId: room.id,
        roomCode: room.room_code,
        status: room.status,
        maxPlayers: room.max_players,
        hostPlayerId: player.id,
        currentTurnPlayerId: null,
        winnerPlayerId: null,
        turnNumber: room.turn_number,
        players: [
          {
            id: player.id,
            displayName: player.display_name,
            seatNo: player.seat_no,
            isHost: player.is_host,
            isReady: player.is_ready,
            status: player.status,
          },
        ],
        createdAt: room.created_at,
      };

      const { error: snapshotError } = await supabase
        .from("game_snapshots")
        .insert({ room_id: room.id, version: 1, state: initialState });

      if (snapshotError) {
        console.error("Failed to create initial room snapshot", snapshotError);
        await supabase.from("rooms").delete().eq("id", room.id);
        return NextResponse.json({ error: snapshotError.message }, { status: 500 });
      }

      const { error: eventError } = await supabase.from("game_events").insert({
        room_id: room.id,
        player_id: player.id,
        event_type: "room_created",
        message: `${player.display_name} created the room.`,
        payload: { roomCode: room.room_code },
      });

      if (eventError) {
        console.error("Failed to create room event", eventError);
        await supabase.from("rooms").delete().eq("id", room.id);
        return NextResponse.json({ error: eventError.message }, { status: 500 });
      }

      return NextResponse.json({
        roomCode: room.room_code,
        playerId: player.id,
        sessionToken,
      });
    }

    return NextResponse.json({ error: "Unable to generate a unique room code. Please try again." }, { status: 503 });
  } catch (error) {
    console.error("Unexpected create-room error", error);
    return jsonError(error, "Unable to create room.");
  }
}
