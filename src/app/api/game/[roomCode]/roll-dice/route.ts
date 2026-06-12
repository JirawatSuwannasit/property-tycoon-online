import { gameOk, handleGameApiError, parseGameActionBody, rollDiceForRoom } from "@/lib/server/game-service";

type GameRouteContext = {
  params: Promise<{ roomCode: string }>;
};

export async function POST(request: Request, { params }: GameRouteContext) {
  try {
    const { roomCode } = await params;
    const { playerId, sessionToken } = await parseGameActionBody(request);
    const state = await rollDiceForRoom(roomCode, playerId, sessionToken);
    return gameOk(state, "Dice rolled.");
  } catch (error) {
    return handleGameApiError(error);
  }
}
