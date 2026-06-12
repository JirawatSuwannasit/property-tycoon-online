import { buyPendingProperty, gameOk, handleGameApiError, parseGameActionBody } from "@/lib/server/game-service";

type GameRouteContext = {
  params: Promise<{ roomCode: string }>;
};

export async function POST(request: Request, { params }: GameRouteContext) {
  try {
    const { roomCode } = await params;
    const { playerId, sessionToken } = await parseGameActionBody(request);
    const state = await buyPendingProperty(roomCode, playerId, sessionToken);
    return gameOk(state, "Landmark rights purchased.");
  } catch (error) {
    return handleGameApiError(error);
  }
}
