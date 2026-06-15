"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { GameBoard } from "@/components/Board/GameBoard";
import { PixelDice } from "@/components/Game/PixelDice";
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

type RollAnimation = {
  playerId: string;
  playerName: string;
  die1: number;
  die2: number;
  total: number;
  fromPosition: number;
  toPosition: number;
  pathTiles: number[];
  passedStart: boolean;
  startBonusAwarded: number;
  landedTileName: string;
  resultingTurnPhase: string;
  pendingAction: string | null;
};

type ActiveMovement = {
  playerId: string;
  position: number;
  activeTileIndex: number | null;
  showStartBonus: boolean;
};

type DiceDisplay = {
  die1: number | null;
  die2: number | null;
  total: number | null;
  playerName: string | null;
  rolling: boolean;
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
      avatar_key: string;
      money: number;
      position: number;
      status: string;
      is_host: boolean;
      turn_order_card: number | null;
      play_order: number | null;
      is_current_turn: boolean;
      is_you: boolean;
    }>;
    tiles: Array<{
      id: string;
      tile_index: number;
      type: string;
      name: string;
      description: string | null;
      price: number | null;
      rent: number | null;
      amount: number | null;
      color_group: string | null;
    }>;
    properties: Array<{
      id: string;
      tile_id: string;
      owner_player_id: string;
      upgrade_level: number;
    }>;
    events: Array<{
      id: string;
      event_type: string;
      message: string;
      created_at: string;
    }>;
    pendingTile: { name: string; tile_index: number; type: string; price: number | null; rent: number | null } | null;
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
  roll?: RollAnimation;
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

function sleep(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function getVisualSecondsRemaining(deadline: string | null, now: number) {
  if (!deadline) {
    return 0;
  }

  return Math.max(0, Math.ceil((new Date(deadline).getTime() - now) / 1000));
}

export function GameDebugPanel({ roomCode }: GameDebugPanelProps) {
  const normalizedRoomCode = roomCode.toUpperCase();
  const sessionRef = useRef<StoredPlayerSession | null>(null);
  const [session, setSession] = useState<StoredPlayerSession | null>(null);
  const [state, setState] = useState<GameApiResponse["state"] | null>(null);
  const [message, setMessage] = useState("Load game state after the host starts the game.");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);
  const [activeMovement, setActiveMovement] = useState<ActiveMovement | null>(null);
  const [diceDisplay, setDiceDisplay] = useState<DiceDisplay>({ die1: null, die2: null, total: null, playerName: null, rolling: false });
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
    sessionRef.current = storedSession;
    setSession(storedSession);
    loadState(storedSession).catch((error) => setMessage(error instanceof Error ? error.message : "Unable to load game state."));
  }, [loadState, normalizedRoomCode]);

  useEffect(() => {
    sessionRef.current = session;
  }, [session]);

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
        loadState(sessionRef.current, true).catch((error) => setMessage(error instanceof Error ? error.message : "Unable to refresh game state."));
      }
    }, 3000);

    return () => window.clearInterval(refreshId);
  }, [isSubmitting, loadState, state?.room.status]);

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
          ? { playerId: sessionRef.current?.playerId }
          : { playerId: sessionRef.current?.playerId, sessionToken: sessionRef.current?.sessionToken };
      const response = await fetch(`/api/game/${normalizedRoomCode}/${action}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await parseJsonResponse<GameApiResponse>(response, "The server returned an empty game response.");

      if (!response.ok || !data.ok || !data.state) {
        throw new Error(data.error ?? "Game action failed.");
      }

      if (action === "roll-dice" && data.roll) {
        setIsAnimating(true);
        setDiceDisplay({ die1: null, die2: null, total: null, playerName: data.roll.playerName, rolling: true });
        setMessage(`${data.roll.playerName} is rolling the dice...`);
        await sleep(1200);
        setDiceDisplay({
          die1: data.roll.die1,
          die2: data.roll.die2,
          total: data.roll.total,
          playerName: data.roll.playerName,
          rolling: false,
        });
        setMessage(`${data.roll.playerName} rolled ${data.roll.die1} + ${data.roll.die2} = ${data.roll.total}.`);

        for (const tileIndex of data.roll.pathTiles) {
          setActiveMovement({
            playerId: data.roll.playerId,
            position: tileIndex,
            activeTileIndex: tileIndex,
            showStartBonus: data.roll.passedStart && tileIndex === 0,
          });
          await sleep(180);
        }

        if (data.roll.passedStart) {
          setMessage(`${data.roll.playerName} passed Start and received +${data.roll.startBonusAwarded} coins.`);
          await sleep(650);
        }

        setMessage(
          `${data.roll.playerName} landed on ${data.roll.landedTileName}.${
            data.roll.pendingAction ? " Decision available." : ""
          }`,
        );
        setActiveMovement(null);
        setIsAnimating(false);
      }

      setState(data.state);
      if (action !== "roll-dice") {
        setMessage(data.message ?? "Game action completed.");
      }
      await loadState(sessionRef.current, true);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Game action failed.");
    } finally {
      setIsSubmitting(false);
      setIsAnimating(false);
    }
  }

  const hints = state?.hints;
  const currentPlayer = state?.players.find((player) => player.is_current_turn) ?? null;
  const localPlayer =
    state?.players.find((player) => player.is_you) ??
    state?.players.find((player) => session?.playerId && player.id === session.playerId) ??
    null;
  const hasServerAction = Boolean(
    hints?.canRoll ||
      hints?.canBuy ||
      hints?.canUpgrade ||
      hints?.canSellProperty ||
      hints?.canSellUpgrade ||
      hints?.canSkipDecision,
  );
  const isCurrentTurnBySession = Boolean(session?.playerId && state?.room.current_turn_player_id === session.playerId);
  const isYourTurn = Boolean(localPlayer?.is_current_turn || isCurrentTurnBySession || hasServerAction);
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
      <PixelPanel className="relative overflow-hidden bg-[#7a4f2a] p-4 shadow-[8px_8px_0_#2b1f3a]" tone="paper">
        <div className="absolute inset-x-0 top-0 h-6 bg-[#a66a3d]" aria-hidden="true" />
        <div className="relative bg-[#f4d58d] bg-[linear-gradient(90deg,rgba(122,79,42,0.14)_1px,transparent_1px),linear-gradient(rgba(122,79,42,0.1)_1px,transparent_1px)] bg-[length:18px_18px] p-5 shadow-[inset_0_0_0_5px_#dfaa62]">
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.2em] text-[#5a4770]">Village Travel Board</p>
            <h2 className="text-3xl font-black">{turnHeadline}</h2>
          </div>
          <PixelButton disabled={isSubmitting} onClick={() => loadState(sessionRef.current)} variant="secondary">
            Refresh Game State
          </PixelButton>
        </div>

        <p className="mb-4 border-4 border-[#2b1f3a] bg-[#fff7df] p-3 text-sm font-bold shadow-[4px_4px_0_#2b1f3a]">{message}</p>

        <PixelDice
          die1={diceDisplay.die1}
          die2={diceDisplay.die2}
          total={diceDisplay.total}
          playerName={diceDisplay.playerName}
          rolling={diceDisplay.rolling}
        />

        {state ? (
          <div className="mt-4 grid gap-3 text-sm font-bold text-[#4d3b61] lg:grid-cols-2">
            <p className="border-4 border-[#2b1f3a] bg-[#fff7df] p-3 shadow-[3px_3px_0_#2b1f3a]">Room status: {state.room.status}</p>
            <p className="border-4 border-[#2b1f3a] bg-[#fff7df] p-3 shadow-[3px_3px_0_#2b1f3a]">Turn phase: {state.room.turn_phase}</p>
            <p className="border-4 border-[#2b1f3a] bg-[#fff7df] p-3 shadow-[3px_3px_0_#2b1f3a]">
              Current turn: {state.room.current_turn_player_name ?? "Waiting..."}
            </p>
            <p className="border-4 border-[#2b1f3a] bg-[#fff7df] p-3 shadow-[3px_3px_0_#2b1f3a]">Countdown: {visualSecondsRemaining}s</p>
            <p className="border-4 border-[#2b1f3a] bg-[#fff7df] p-3 shadow-[3px_3px_0_#2b1f3a]">Pending: {state.room.pending_action ?? "None"}</p>
            <p className="border-4 border-[#2b1f3a] bg-[#fff7df] p-3 shadow-[3px_3px_0_#2b1f3a]">Pending tile: {state.pendingTile?.name ?? "None"}</p>
            <p className="border-4 border-[#2b1f3a] bg-[#fff7df] p-3 shadow-[3px_3px_0_#2b1f3a]">Winner: {state.winner?.display_name ?? "None"}</p>
          </div>
        ) : null}

        {state?.players.length ? (
          <div className="mt-5 grid gap-2 border-4 border-[#2b1f3a] bg-[#d9a45f] p-3 shadow-[4px_4px_0_#2b1f3a]">
            <p className="text-xs font-black uppercase tracking-[0.2em] text-[#5a4770]">Server Turn Order</p>
            {state.players.map((player) => (
              <div
                key={player.id}
                className={`border-4 border-[#2b1f3a] flex flex-wrap items-center justify-between gap-2 p-3 text-sm font-black shadow-[3px_3px_0_#2b1f3a] ${
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

        {state?.tiles.length ? (
          <div className="mt-5 overflow-x-auto pb-3">
            <GameBoard
              tiles={state.tiles}
              players={state.players}
              properties={state.properties}
              currentTurnPlayerId={state.room.current_turn_player_id}
              pendingTileId={pendingDecision?.tileId ?? null}
              animatedPlayerPositions={activeMovement ? { [activeMovement.playerId]: activeMovement.position } : {}}
              activePathTileIndex={activeMovement?.activeTileIndex ?? null}
              showStartBonus={activeMovement?.showStartBonus ?? false}
            />
          </div>
        ) : null}

        {process.env.NODE_ENV === "development" ? (
          <div className="pixel-border mt-5 grid gap-2 bg-[#cdb4db] p-4 text-xs font-bold text-[#2b1f3a] sm:grid-cols-2 lg:grid-cols-3">
            <p>localPlayerId: {session?.playerId ?? "none"}</p>
            <p>localSessionToken: {session?.sessionToken ? "exists" : "missing"}</p>
            <p>currentTurnPlayerId: {state?.room.current_turn_player_id ?? "none"}</p>
            <p>currentUserPlayerId: {localPlayer?.id ?? "none"}</p>
            <p>isHost: {localPlayer?.is_host ? "true" : "false"}</p>
            <p>isCurrentTurn: {isYourTurn ? "true" : "false"}</p>
            <p>room.status: {state?.room.status ?? "none"}</p>
            <p>turn_phase: {state?.room.turn_phase ?? "none"}</p>
            <p>pending_action: {state?.room.pending_action ?? "none"}</p>
            <p>pending_tile_id: {pendingDecision?.tileId ?? "none"}</p>
            <p>pending tile type: {state?.pendingTile?.type ?? "none"}</p>
            <p>pending tile owner id: {pendingDecision?.ownerPlayerId ?? "none"}</p>
            <p>canRoll: {hints?.canRoll ? "true" : "false"}</p>
            <p>canBuy: {hints?.canBuy ? "true" : "false"}</p>
            <p>canUpgrade: {hints?.canUpgrade ? "true" : "false"}</p>
            <p>canSellProperty: {hints?.canSellProperty ? "true" : "false"}</p>
            <p>canSellUpgrade: {hints?.canSellUpgrade ? "true" : "false"}</p>
            <p>canSkipDecision: {hints?.canSkipDecision ? "true" : "false"}</p>
            <p>secondsRemaining: {hints?.secondsRemaining ?? 0}</p>
          </div>
        ) : null}

        <div className="mt-5 border-4 border-[#2b1f3a] bg-[#fff7df] p-4 shadow-[5px_5px_0_#2b1f3a]">
          {!state || state.room.status !== "playing" ? (
            <p className="font-bold text-[#4d3b61]">Start the game from the lobby controls to enable server gameplay actions.</p>
          ) : !isYourTurn ? (
            <p className="font-bold text-[#4d3b61]">Waiting for {state.room.current_turn_player_name ?? "the current player"}.</p>
          ) : state.room.turn_phase === "waiting_to_roll" ? (
            <div className="space-y-3">
              <p className="font-bold text-[#4d3b61]">Roll within {visualSecondsRemaining}s or the server will auto-roll.</p>
              <PixelButton disabled={isSubmitting || isAnimating || !hints?.canRoll} onClick={() => postAction("roll-dice")}>Roll Dice</PixelButton>
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
                <PixelButton disabled={isSubmitting || isAnimating || !hints?.canBuy} onClick={() => postAction("buy-property")}>Buy Rights</PixelButton>
                <PixelButton disabled={isSubmitting || isAnimating || !hints?.canSkipDecision} onClick={() => postAction("skip-decision")} variant="accent">Skip</PixelButton>
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
                <PixelButton disabled={isSubmitting || isAnimating || !hints?.canUpgrade} onClick={() => postAction("upgrade-property")}>Upgrade Facilities</PixelButton>
                <PixelButton disabled={isSubmitting || isAnimating || !hints?.canSellUpgrade} onClick={() => postAction("sell-upgrade")} variant="secondary">Sell Upgrade</PixelButton>
                <PixelButton disabled={isSubmitting || isAnimating || !hints?.canSellProperty} onClick={() => postAction("sell-property")} variant="secondary">Sell Property</PixelButton>
                <PixelButton disabled={isSubmitting || isAnimating || !hints?.canSkipDecision} onClick={() => postAction("skip-decision")} variant="accent">Skip</PixelButton>
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

        {state?.events.length ? (
          <div className="mt-5 max-h-72 overflow-y-auto border-4 border-[#2b1f3a] bg-[#fff7df] p-4 shadow-[5px_5px_0_#2b1f3a]">
            <div className="mb-3 flex items-center justify-between gap-3">
              <p className="text-xs font-black uppercase tracking-[0.2em] text-[#5a4770]">Event Log</p>
              <span className="pixel-border bg-[#a0d8ff] px-2 py-1 text-[10px] font-black uppercase">Latest {state.events.length}</span>
            </div>
            <div className="grid gap-2">
              {state.events.slice(0, 12).map((event) => (
                <div key={event.id} className="border-4 border-[#2b1f3a] bg-white p-3 text-xs font-bold text-[#4d3b61] shadow-[3px_3px_0_#2b1f3a]">
                  <p className="font-black uppercase text-[#2b1f3a]">{event.event_type.replaceAll("_", " ")}</p>
                  <p>{event.message}</p>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        <p className="mt-4 text-xs font-bold text-[#5a4770]">
          This panel only displays server-provided state and calls API routes. Dice, movement, money, rent, ownership, upgrades, and timeouts are computed on the server.
        </p>
        </div>
      </PixelPanel>
    </section>
  );
}
