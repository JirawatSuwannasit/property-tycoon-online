import { gameOk, handleGameApiError, parseGameActionBody, sellPendingUpgrade } from "@/lib/server/game-service";

type RouteContext = {
  params: Promise<{ roomCode: string }>;
};

export async function POST(request: Request, { params }: RouteContext) {
  try {
    const { roomCode } = await params;
    const { playerId, sessionToken } = await parseGameActionBody(request);
    const state = await sellPendingUpgrade(roomCode, playerId, sessionToken);
    return gameOk(state, "Upgrade sold.");
  } catch (error) {
    return handleGameApiError(error);
  }
}
