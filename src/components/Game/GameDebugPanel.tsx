"use client";

import { useCallback, useEffect, useState } from "react";
import { PixelButton, PixelPanel } from "@/components/ui";
import { parseJsonResponse } from "@/lib/client/http";
import { loadPlayerSession, type StoredPlayerSession } from "@/lib/client/player-session";

type GameApiResponse = {
  ok: boolean;
  state?: {
    room: {
      status: string;
      turn_phase: string;
      action_deadline_at: string | null;
      pending_action: string | null;
      current_turn_player_id: string | null;
      winner_player_id: string | null;
      turn_number: number;
    };
    players: Array<{ id: string; display_name: string; money: number; position: number; status: string }>;
    pendingTile: { name: string; tile_index: number } | null;
    winner: { display_name: string } | null;
    hints: {
      canRoll: boolean;
      canBuy: boolean;
      canUpgrade: boolean;
      canSkipDecision: boolean;
      secondsRemaining: number;
    };
  };
  message?: string;
  error?: string;
  code?: string;
};

type GameDebugPanelProps = {
  roomCode: string;
};

function getSessionHeaders(session: StoredPlayerSession | null): HeadersInit {
  if (!session) {
    return {};
  }

  return { "x-player-id": session.playerId, "x-session-token": session.sessionToken };
}

export function GameDebugPanel({ roomCode }: GameDebugPanelProps) {
  const normalizedRoomCode = roomCode.toUpperCase();
  const [session, setSession] = useState<StoredPlayerSession | null>(null);
  const [state, setState] = useState<GameApiResponse["state"] | null>(null);
  const [message, setMessage] = useState("Load game state after the host starts the game.");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const loadState = useCallback(
    async (activeSession: StoredPlayerSession | null) => {
      const response = await fetch(`/api/game/${normalizedRoomCode}/state`, {
        headers: getSessionHeaders(activeSession),
        cache: "no-store",
      });
      const data = await parseJsonResponse<GameApiResponse>(response, "The server returned an empty game response.");

      if (!response.ok || !data.ok || !data.state) {
        throw new Error(data.error ?? "Unable to load game state.");
      }

      setState(data.state);
      setMessage(data.message ?? "Game state loaded.");
    },
    [normalizedRoomCode],
  );

  useEffect(() => {
    const storedSession = loadPlayerSession(normalizedRoomCode);
    setSession(storedSession);
    loadState(storedSession).catch((error) => setMessage(error instanceof Error ? error.message : "Unable to load game state."));
  }, [loadState, normalizedRoomCode]);

  async function postAction(action: "roll-dice" | "buy-property" | "upgrade-property" | "skip-decision" | "resolve-timeout") {
    setIsSubmitting(true);

    try {
      const body =
        action === "resolve-timeout"
          ? { playerId: session?.playerId }
          : { playerId: session?.playerId, sessionToken: session?.sessionToken };
      const response = await fetch(`/api/game/${normalizedRoomCode}/${action}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await parseJsonResponse<GameApiResponse>(response, "The server returned an empty game response.");

      if (!response.ok || !data.ok || !data.state) {
        throw new Error(data.error ?? "Game action failed.");
      }

      setState(data.state);
      setMessage(data.message ?? "Game action completed.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Game action failed.");
    } finally {
      setIsSubmitting(false);
    }
  }

  const hints = state?.hints;

  return (
    <section className="mx-auto max-w-7xl px-5 pb-10 sm:px-8 lg:px-12">
      <PixelPanel className="p-6" tone="mint">
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.2em] text-[#5a4770]">Phase 6 debug actions</p>
            <h2 className="text-3xl font-black">Server Game Controls</h2>
          </div>
          <PixelButton disabled={isSubmitting} onClick={() => loadState(session)} variant="secondary">
            Refresh Game State
          </PixelButton>
        </div>
        <p className="pixel-border mb-4 bg-[#fff7df] p-3 text-sm font-bold">{message}</p>
        {state ? (
          <div className="grid gap-3 text-sm font-bold text-[#4d3b61] lg:grid-cols-2">
            <p className="pixel-border bg-[#fff7df] p-3">Room status: {state.room.status}</p>
            <p className="pixel-border bg-[#fff7df] p-3">Turn phase: {state.room.turn_phase}</p>
            <p className="pixel-border bg-[#fff7df] p-3">Deadline: {state.hints.secondsRemaining}s</p>
            <p className="pixel-border bg-[#fff7df] p-3">Pending: {state.room.pending_action ?? "None"}</p>
            <p className="pixel-border bg-[#fff7df] p-3">Pending tile: {state.pendingTile?.name ?? "None"}</p>
            <p className="pixel-border bg-[#fff7df] p-3">Winner: {state.winner?.display_name ?? "None"}</p>
          </div>
        ) : null}
        <div className="mt-5 flex flex-wrap gap-3">
          <PixelButton disabled={isSubmitting || !hints?.canRoll} onClick={() => postAction("roll-dice")}>Roll Dice</PixelButton>
          <PixelButton disabled={isSubmitting || !hints?.canBuy} onClick={() => postAction("buy-property")} variant="secondary">Buy Rights</PixelButton>
          <PixelButton disabled={isSubmitting || !hints?.canUpgrade} onClick={() => postAction("upgrade-property")} variant="secondary">Upgrade Facilities</PixelButton>
          <PixelButton disabled={isSubmitting || !hints?.canSkipDecision} onClick={() => postAction("skip-decision")} variant="accent">Skip Decision</PixelButton>
          <PixelButton disabled={isSubmitting} onClick={() => postAction("resolve-timeout")} variant="accent">Resolve Timeout</PixelButton>
        </div>
        <p className="mt-4 text-xs font-bold text-[#5a4770]">
          These buttons call server API routes only. Dice, movement, money, rent, ownership, upgrades, and timeouts are computed on the server.
        </p>
      </PixelPanel>
    </section>
  );
}
