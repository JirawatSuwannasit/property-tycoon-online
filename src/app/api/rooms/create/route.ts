import { NextResponse } from "next/server";
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
        .select("id, room_code")
        .single();

      if (roomError) {
        if (roomError.code === "23505") {
          continue;
        }

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
        .select("id")
        .single();

      if (playerError) {
        await supabase.from("rooms").delete().eq("id", room.id);
        return NextResponse.json({ error: playerError.message }, { status: 500 });
      }

      const { error: updateError } = await supabase
        .from("rooms")
        .update({ host_player_id: player.id })
        .eq("id", room.id);

      if (updateError) {
        await supabase.from("rooms").delete().eq("id", room.id);
        return NextResponse.json({ error: updateError.message }, { status: 500 });
      }

      return NextResponse.json({
        roomCode: room.room_code,
        playerId: player.id,
        sessionToken,
      });
    }

    return NextResponse.json({ error: "Unable to generate a unique room code. Please try again." }, { status: 503 });
  } catch (error) {
    return jsonError(error, "Unable to create room.");
  }
}
