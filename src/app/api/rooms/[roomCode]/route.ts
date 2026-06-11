import { NextResponse } from "next/server";
import { getLobbyState } from "@/lib/server/room-lobby";

type RoomRouteContext = {
  params: Promise<{ roomCode: string }>;
};

export async function GET(request: Request, { params }: RoomRouteContext) {
  const { roomCode } = await params;
  const playerId = request.headers.get("x-player-id");
  const sessionToken = request.headers.get("x-session-token");

  try {
    const lobbyState = await getLobbyState(roomCode, { playerId, sessionToken });

    if (!lobbyState) {
      return NextResponse.json({ error: "Room not found." }, { status: 404 });
    }

    return NextResponse.json(lobbyState);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to load lobby." },
      { status: 500 },
    );
  }
}
