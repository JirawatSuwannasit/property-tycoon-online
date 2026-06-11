import { NextResponse } from "next/server";
import { canStartRoom, getLobbyState, validatePlayerSession } from "@/lib/server/room-lobby";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

type StartRouteContext = {
  params: Promise<{ roomCode: string }>;
};

type StartBody = {
  playerId?: string;
  sessionToken?: string;
};

function jsonError(error: unknown, fallbackMessage: string, status = 500) {
  return NextResponse.json(
    { error: error instanceof Error ? error.message : fallbackMessage },
    { status },
  );
}

export async function POST(request: Request, { params }: StartRouteContext) {
  try {
    const { roomCode } = await params;
    const body = (await request.json().catch(() => null)) as StartBody | null;

    if (!body?.playerId || !body.sessionToken) {
      return NextResponse.json({ error: "Missing player session." }, { status: 401 });
    }

    const validated = await validatePlayerSession(roomCode, body.playerId, body.sessionToken);

    if (!validated) {
      return NextResponse.json({ error: "Invalid player session." }, { status: 401 });
    }

    const { lobbyState, player } = validated;

    if (!player.is_host || lobbyState.room.host_player_id !== player.id) {
      return NextResponse.json({ error: "Only the host can start the game." }, { status: 403 });
    }

    if (!canStartRoom(lobbyState.room, lobbyState.players)) {
      return NextResponse.json(
        { error: "Need 2-4 players and all non-host players must be ready before starting." },
        { status: 409 },
      );
    }

    const supabase = createSupabaseAdminClient();
    const { error } = await supabase
      .from("rooms")
      .update({ status: "playing" })
      .eq("id", lobbyState.room.id)
      .eq("status", "waiting");

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const updatedLobbyState = await getLobbyState(roomCode, {
      playerId: body.playerId,
      sessionToken: body.sessionToken,
    });

    return NextResponse.json(updatedLobbyState);
  } catch (error) {
    return jsonError(error, "Unable to start game.");
  }
}
