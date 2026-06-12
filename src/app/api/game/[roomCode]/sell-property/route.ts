import { gameOk, handleGameApiError, parseGameActionBody, sellPendingProperty } from "@/lib/server/game-service";

type RouteContext = {
  params: Promise<{ roomCode: string }>;
};

export async function POST(request: Request, { params }: RouteContext) {
  try {
    const { roomCode } = await params;
    const { playerId, sessionToken } = await parseGameActionBody(request);
    const state = await sellPendingProperty(roomCode, playerId, sessionToken);
    return gameOk(state, "Property sold.");
  } catch (error) {
    return handleGameApiError(error);
  }
}
