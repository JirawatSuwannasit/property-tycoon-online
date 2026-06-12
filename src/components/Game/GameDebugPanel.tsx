"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { PixelButton, PixelPanel } from "@/components/ui";
import { parseJsonResponse } from "@/lib/client/http";
import { loadPlayerSession, type StoredPlayerSession } from "@/lib/client/player-session";

type PendingDecision = {
  action: "buy_property" | "upgrade_property";
  tileId: string;
  tileName: string;
  tileIndex: number;
  price: number | null;
  baseRent: number | null;
  ownerPlayerId: string | null;
  currentUpgradeLevel: number | null;
  currentRent: number | null;
  upgradeCost: number | null;
  newRent: number | null;
  sellUpgradeRefund: number | null;
  sellPropertyRefund: number | null;
  secondsRemaining: number;
};

type GameApiResponse = {
  ok: boolean;
  state?: {
    room: {
      status: string;
      turn_phase: string;
      action_deadline_at: string | null;
      pending_action: string | null;
      current_turn_player_id: string | null;
      current_turn_player_name: string | null;
      winner_player_id: string | null;
      turn_number: number;
    };
    players: Array<{
      id: string;
      display_name: string;
      money: number;
      position: number;
      status: string;
      turn_order_card: number | null;
      play_order: number | null;
      is_current_turn: boolean;
      is_you: boolean;
    }>;
    pendingTile: { name: string; tile_index: number; price: number | null; rent: number | null } | null;
    pendingDecision: PendingDecision | null;
    winner: { display_name: string } | null;
    hints: {
      canRoll: boolean;
      canBuy: boolean;
      canUpgrade: boolean;
      canSellUpgrade: boolean;
      canSellProperty: boolean;
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

function formatCoins(value: number | null) {
  return value == null ? "—" : `${value} coins`;
}

function getVisualSecondsRemaining(deadline: string | null, now: number) {
  if (!deadline) {
    return 0;
  }

  return Math.max(0, Math.ceil((new Date(deadline).getTime() - now) / 1000));
}

export function GameDebugPanel({ roomCode }: GameDebugPanelProps) {
  const normalizedRoomCode = roomCode.toUpperCase();
  const [session, setSession] = useState<StoredPlayerSession | null>(null);
  const [state, setState] = useState<GameApiResponse["state"] | null>(null);
  const [message, setMessage] = useState("Load game state after the host starts the game.");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [now, setNow] = useState(Date.now());

  const loadState = useCallback(
    async (activeSession: StoredPlayerSession | null, quiet = false) => {
      const response = await fetch(`/api/game/${normalizedRoomCode}/state`, {
        headers: getSessionHeaders(activeSession),
        cache: "no-store",
      });
      const data = await parseJsonResponse<GameApiResponse>(response, "The server returned an empty game response.");

      if (!response.ok || !data.ok || !data.state) {
        throw new Error(data.error ?? "Unable to load game state.");
      }

      setState(data.state);
      if (!quiet) {
        setMessage(data.message ?? "Game state loaded.");
      }
    },
    [normalizedRoomCode],
  );

  useEffect(() => {
    const storedSession = loadPlayerSession(normalizedRoomCode);
    setSession(storedSession);
    loadState(storedSession).catch((error) => setMessage(error instanceof Error ? error.message : "Unable to load game state."));
  }, [loadState, normalizedRoomCode]);

  useEffect(() => {
    const tickId = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(tickId);
  }, []);

  useEffect(() => {
    if (state?.room.status !== "playing") {
      return undefined;
    }

    const refreshId = window.setInterval(() => {
      if (!isSubmitting) {
        loadState(session, true).catch((error) => setMessage(error instanceof Error ? error.message : "Unable to refresh game state."));
      }
    }, 3000);

    return () => window.clearInterval(refreshId);
  }, [isSubmitting, loadState, session, state?.room.status]);

  async function postAction(
    action:
      | "roll-dice"
      | "buy-property"
      | "upgrade-property"
      | "sell-upgrade"
      | "sell-property"
      | "skip-decision"
      | "resolve-timeout",
  ) {
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
      await loadState(session, true);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Game action failed.");
    } finally {
      setIsSubmitting(false);
    }
  }

  const hints = state?.hints;
  const currentPlayer = state?.players.find((player) => player.is_current_turn) ?? null;
  const localPlayer = state?.players.find((player) => player.is_you) ?? null;
  const isYourTurn = Boolean(localPlayer?.is_current_turn || (session?.playerId && state?.room.current_turn_player_id === session.playerId));
  const pendingDecision = state?.pendingDecision ?? null;
  const visualSecondsRemaining = getVisualSecondsRemaining(state?.room.action_deadline_at ?? null, now);

  const turnHeadline = useMemo(() => {
    if (!state || state.room.status !== "playing") {
      return "Game actions appear after the host starts the game.";
    }

    if (isYourTurn) {
      return "Your turn";
    }

    return `Waiting for ${state.room.current_turn_player_name ?? currentPlayer?.display_name ?? "the current player"}`;
  }, [currentPlayer?.display_name, isYourTurn, state]);

  return (
    <section className="mx-auto max-w-7xl px-5 pb-10 sm:px-8 lg:px-12">
      <PixelPanel className="p-6" tone="mint">
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.2em] text-[#5a4770]">Phase 6.6 gameplay actions</p>
            <h2 className="text-3xl font-black">{turnHeadline}</h2>
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
            <p className="pixel-border bg-[#fff7df] p-3">
              Current turn: {state.room.current_turn_player_name ?? "Waiting..."}
            </p>
            <p className="pixel-border bg-[#fff7df] p-3">Countdown: {visualSecondsRemaining}s</p>
            <p className="pixel-border bg-[#fff7df] p-3">Pending: {state.room.pending_action ?? "None"}</p>
            <p className="pixel-border bg-[#fff7df] p-3">Pending tile: {state.pendingTile?.name ?? "None"}</p>
            <p className="pixel-border bg-[#fff7df] p-3">Winner: {state.winner?.display_name ?? "None"}</p>
          </div>
        ) : null}

        {state?.players.length ? (
          <div className="mt-5 grid gap-2">
            <p className="text-xs font-black uppercase tracking-[0.2em] text-[#5a4770]">Server Turn Order</p>
            {state.players.map((player) => (
              <div
                key={player.id}
                className={`pixel-border flex flex-wrap items-center justify-between gap-2 p-3 text-sm font-black ${
                  player.is_current_turn ? "bg-[#ffd166]" : player.is_you ? "bg-[#b8f2d0]" : "bg-[#fff7df]"
                }`}
              >
                <span>
                  #{player.play_order ?? "?"} {player.display_name} — Card {player.turn_order_card ?? "?"}
                </span>
                <span className="uppercase">{player.is_current_turn ? "Current Turn" : player.is_you ? "You" : "Waiting"}</span>
              </div>
            ))}
          </div>
        ) : null}

        <div className="pixel-border mt-5 bg-[#fff7df] p-4">
          {!state || state.room.status !== "playing" ? (
            <p className="font-bold text-[#4d3b61]">Start the game from the lobby controls to enable server gameplay actions.</p>
          ) : !isYourTurn ? (
            <p className="font-bold text-[#4d3b61]">Waiting for {state.room.current_turn_player_name ?? "the current player"}.</p>
          ) : state.room.turn_phase === "waiting_to_roll" ? (
            <div className="space-y-3">
              <p className="font-bold text-[#4d3b61]">Roll within {visualSecondsRemaining}s or the server will auto-roll.</p>
              <PixelButton disabled={isSubmitting || !hints?.canRoll} onClick={() => postAction("roll-dice")}>Roll Dice</PixelButton>
            </div>
          ) : pendingDecision?.action === "buy_property" ? (
            <div className="space-y-4">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.2em] text-[#5a4770]">Buy Landmark Rights</p>
                <h3 className="text-2xl font-black">{pendingDecision.tileName}</h3>
              </div>
              <div className="grid gap-2 text-sm font-bold text-[#4d3b61] sm:grid-cols-3">
                <p className="pixel-border bg-white p-3">Price: {formatCoins(pendingDecision.price)}</p>
                <p className="pixel-border bg-white p-3">Base rent: {formatCoins(pendingDecision.baseRent)}</p>
                <p className="pixel-border bg-white p-3">Decision timer: {visualSecondsRemaining}s</p>
              </div>
              <div className="flex flex-wrap gap-3">
                <PixelButton disabled={isSubmitting || !hints?.canBuy} onClick={() => postAction("buy-property")}>Buy Rights</PixelButton>
                <PixelButton disabled={isSubmitting || !hints?.canSkipDecision} onClick={() => postAction("skip-decision")} variant="accent">Skip</PixelButton>
              </div>
              {!hints?.canBuy ? <p className="text-xs font-bold text-[#5a4770]">Buy is disabled unless the server says this player can afford the pending property.</p> : null}
            </div>
          ) : pendingDecision?.action === "upgrade_property" ? (
            <div className="space-y-4">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.2em] text-[#5a4770]">Upgrade Visitor Facilities</p>
                <h3 className="text-2xl font-black">{pendingDecision.tileName}</h3>
              </div>
              <div className="grid gap-2 text-sm font-bold text-[#4d3b61] sm:grid-cols-2 lg:grid-cols-4">
                <p className="pixel-border bg-white p-3">Current level: {pendingDecision.currentUpgradeLevel ?? 0}</p>
                <p className="pixel-border bg-white p-3">Upgrade cost: {formatCoins(pendingDecision.upgradeCost)}</p>
                <p className="pixel-border bg-white p-3">Current rent: {formatCoins(pendingDecision.currentRent)}</p>
                <p className="pixel-border bg-white p-3">New rent: {formatCoins(pendingDecision.newRent)}</p>
                <p className="pixel-border bg-white p-3">Sell upgrade refund: {formatCoins(pendingDecision.sellUpgradeRefund)}</p>
                <p className="pixel-border bg-white p-3">Sell property refund: {formatCoins(pendingDecision.sellPropertyRefund)}</p>
                <p className="pixel-border bg-white p-3">Decision timer: {visualSecondsRemaining}s</p>
              </div>
              <p className="text-xs font-bold text-[#5a4770]">
                Sale refunds are intentionally lower than purchase and upgrade costs. Sell upgrades first before selling landmark rights.
              </p>
              <div className="flex flex-wrap gap-3">
                <PixelButton disabled={isSubmitting || !hints?.canUpgrade} onClick={() => postAction("upgrade-property")}>Upgrade Facilities</PixelButton>
                <PixelButton disabled={isSubmitting || !hints?.canSellUpgrade} onClick={() => postAction("sell-upgrade")} variant="secondary">Sell Upgrade</PixelButton>
                <PixelButton disabled={isSubmitting || !hints?.canSellProperty} onClick={() => postAction("sell-property")} variant="secondary">Sell Property</PixelButton>
                <PixelButton disabled={isSubmitting || !hints?.canSkipDecision} onClick={() => postAction("skip-decision")} variant="accent">Skip</PixelButton>
              </div>
              {!hints?.canUpgrade && !hints?.canSellUpgrade && !hints?.canSellProperty ? (
                <p className="text-xs font-bold text-[#5a4770]">
                  Own-property actions are disabled unless the server says this player owns the property and the selected action is legal.
                </p>
              ) : null}
            </div>
          ) : (
            <div className="space-y-3">
              <p className="font-bold text-[#4d3b61]">The server is resolving the turn or waiting for the next action.</p>
              <PixelButton disabled={isSubmitting} onClick={() => postAction("resolve-timeout")} variant="accent">Resolve Timeout</PixelButton>
            </div>
          )}
        </div>

        <p className="mt-4 text-xs font-bold text-[#5a4770]">
          This panel only displays server-provided state and calls API routes. Dice, movement, money, rent, ownership, upgrades, and timeouts are computed on the server.
        </p>
      </PixelPanel>
    </section>
  );
}
