import { NextResponse } from "next/server";
import { getGameStateByRoomCode, handleGameApiError } from "@/lib/server/game-service";

type GameRouteContext = {
  params: Promise<{ roomCode: string }>;
};

export async function GET(request: Request, { params }: GameRouteContext) {
  try {
    const { roomCode } = await params;
    const playerId = request.headers.get("x-player-id");
    const state = await getGameStateByRoomCode(roomCode, playerId);
    return NextResponse.json({ ok: true, state, message: "Game state loaded." });
  } catch (error) {
    return handleGameApiError(error);
  }
}
