import { NextResponse } from "next/server";
import { handleGameApiError, parseGameActionBody, rollDiceForRoom } from "@/lib/server/game-service";

type GameRouteContext = {
  params: Promise<{ roomCode: string }>;
};

export async function POST(request: Request, { params }: GameRouteContext) {
  try {
    const { roomCode } = await params;
    const { playerId, sessionToken } = await parseGameActionBody(request);
    const { state, roll } = await rollDiceForRoom(roomCode, playerId, sessionToken);
    return NextResponse.json({ ok: true, state, roll, message: `${roll.playerName} rolled ${roll.total}.` });
  } catch (error) {
    return handleGameApiError(error);
  }
}
