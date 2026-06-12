import { gameOk, handleGameApiError, parseGameActionBody, upgradePendingProperty } from "@/lib/server/game-service";

type GameRouteContext = {
  params: Promise<{ roomCode: string }>;
};

export async function POST(request: Request, { params }: GameRouteContext) {
  try {
    const { roomCode } = await params;
    const { playerId, sessionToken } = await parseGameActionBody(request);
    const state = await upgradePendingProperty(roomCode, playerId, sessionToken);
    return gameOk(state, "Visitor facilities upgraded.");
  } catch (error) {
    return handleGameApiError(error);
  }
}
