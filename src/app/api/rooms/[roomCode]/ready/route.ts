import { NextResponse } from "next/server";
import { getLobbyState, validatePlayerSession } from "@/lib/server/room-lobby";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

type ReadyRouteContext = {
  params: Promise<{ roomCode: string }>;
};

type ReadyBody = {
  playerId?: string;
  sessionToken?: string;
  isReady?: boolean;
};

function jsonError(error: unknown, fallbackMessage: string, status = 500) {
  return NextResponse.json(
    { error: error instanceof Error ? error.message : fallbackMessage },
    { status },
  );
}

export async function POST(request: Request, { params }: ReadyRouteContext) {
  try {
    const { roomCode } = await params;
    const body = (await request.json().catch(() => null)) as ReadyBody | null;

    if (!body?.playerId || !body.sessionToken) {
      return NextResponse.json({ error: "Missing player session." }, { status: 401 });
    }

    const validated = await validatePlayerSession(roomCode, body.playerId, body.sessionToken);

    if (!validated) {
      return NextResponse.json({ error: "Invalid player session." }, { status: 401 });
    }

    const { lobbyState, player } = validated;

    if (lobbyState.room.status !== "waiting") {
      return NextResponse.json({ error: "Ready status can only change while waiting." }, { status: 409 });
    }

    if (player.is_host) {
      return NextResponse.json({ error: "Host is always ready." }, { status: 403 });
    }

    const nextReadyState = typeof body.isReady === "boolean" ? body.isReady : !player.is_ready;
    const supabase = createSupabaseAdminClient();
    const { error } = await supabase
      .from("players")
      .update({ is_ready: nextReadyState })
      .eq("id", player.id)
      .eq("room_id", lobbyState.room.id)
      .eq("is_host", false);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const updatedLobbyState = await getLobbyState(roomCode, {
      playerId: body.playerId,
      sessionToken: body.sessionToken,
    });

    return NextResponse.json(updatedLobbyState);
  } catch (error) {
    console.error("Room API error", error);
    return jsonError(error, "Unable to update ready status.");
  }
}
