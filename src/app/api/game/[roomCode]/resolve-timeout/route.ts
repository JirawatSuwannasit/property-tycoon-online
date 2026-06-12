import { gameOk, handleGameApiError, resolveTimeoutByRoomCode } from "@/lib/server/game-service";

type GameRouteContext = {
  params: Promise<{ roomCode: string }>;
};

export async function POST(request: Request, { params }: GameRouteContext) {
  try {
    const { roomCode } = await params;
    const body = (await request.json().catch(() => null)) as { playerId?: string } | null;
    const state = await resolveTimeoutByRoomCode(roomCode, body?.playerId);
    return gameOk(state, "Timeout checked.");
  } catch (error) {
    return handleGameApiError(error);
  }
}
