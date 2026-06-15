import { gameOk, handleGameApiError, parseGameActionBody, skipPendingDecision } from "@/lib/server/game-service";

type GameRouteContext = {
  params: Promise<{ roomCode: string }>;
};

export async function POST(request: Request, { params }: GameRouteContext) {
  try {
    const { roomCode } = await params;
    const { playerId, sessionToken } = await parseGameActionBody(request);
    const state = await skipPendingDecision(roomCode, playerId, sessionToken);
    return gameOk(state, "Decision skipped.");
  } catch (error) {
    return handleGameApiError(error);
  }
}
