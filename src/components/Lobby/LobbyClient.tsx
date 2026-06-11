"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { PixelButton, PixelCard, PixelPanel } from "@/components/ui";
import { parseJsonResponse } from "@/lib/client/http";
import { loadPlayerSession, type StoredPlayerSession } from "@/lib/client/player-session";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import type { PlayerStatus, RoomStatus } from "@/lib/database.types";

type LobbyPlayer = {
  id: string;
  display_name: string;
  avatar_key: string;
  seat_no: number;
  is_host: boolean;
  is_ready: boolean;
  status: PlayerStatus;
  created_at: string;
};

type LobbyState = {
  room: {
    id: string;
    room_code: string;
    status: RoomStatus;
    max_players: number;
    host_player_id: string | null;
    current_turn_player_id: string | null;
    winner_player_id: string | null;
    turn_number: number;
    created_at: string;
    updated_at: string;
  };
  players: LobbyPlayer[];
  currentPlayer: LobbyPlayer | null;
  canStartGame: boolean;
  startRequirements: {
    isWaiting: boolean;
    hasEnoughPlayers: boolean;
    hasRoomCapacity: boolean;
    allNonHostsReady: boolean;
  };
};

type LobbyClientProps = {
  roomCode: string;
};

type LiveStatus = "connecting" | "live" | "reconnecting" | "offline";

function statusLabel(status: RoomStatus) {
  if (status === "waiting") {
    return "Waiting for players";
  }

  if (status === "playing") {
    return "Game started";
  }

  return "Finished";
}

function getPlayerBadge(player: LobbyPlayer) {
  if (player.is_host) {
    return "Host";
  }

  return player.is_ready ? "Ready" : "Not Ready";
}

function getSessionHeaders(session: StoredPlayerSession | null): HeadersInit {
  if (!session) {
    return {};
  }

  return {
    "x-player-id": session.playerId,
    "x-session-token": session.sessionToken,
  };
}

function liveStatusLabel(status: LiveStatus) {
  if (status === "live") {
    return "Live";
  }

  if (status === "reconnecting") {
    return "Reconnecting";
  }

  if (status === "offline") {
    return "Offline";
  }

  return "Connecting";
}

function liveStatusClassName(status: LiveStatus) {
  if (status === "live") {
    return "bg-[#b8f2d0]";
  }

  if (status === "offline") {
    return "bg-[#ff9aa2]";
  }

  return "bg-[#ffd166]";
}

export function LobbyClient({ roomCode }: LobbyClientProps) {
  const normalizedRoomCode = roomCode.toUpperCase();
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const reconnectTimerRef = useRef<number | null>(null);
  const refetchTimerRef = useRef<number | null>(null);
  const lastRefetchAtRef = useRef(0);
  const [session, setSession] = useState<StoredPlayerSession | null>(null);
  const [lobbyState, setLobbyState] = useState<LobbyState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [liveStatus, setLiveStatus] = useState<LiveStatus>("connecting");

  const fetchLobby = useCallback(
    async (activeSession: StoredPlayerSession | null) => {
      const response = await fetch(`/api/rooms/${normalizedRoomCode}`, {
        headers: getSessionHeaders(activeSession),
        cache: "no-store",
      });
      const data = await parseJsonResponse<LobbyState>(response, "The server returned an empty lobby response.");

      if (!response.ok) {
        throw new Error(data.error ?? "Unable to load lobby.");
      }

      if (!data.room || !data.players) {
        throw new Error(data.error ?? "The server response was missing lobby details.");
      }

      lastRefetchAtRef.current = Date.now();
      setLobbyState(data);
      setError(null);
    },
    [normalizedRoomCode],
  );

  useEffect(() => {
    const storedSession = loadPlayerSession(normalizedRoomCode);
    setSession(storedSession);

    fetchLobby(storedSession)
      .catch((fetchError) => setError(fetchError instanceof Error ? fetchError.message : "Unable to load lobby."))
      .finally(() => setIsLoading(false));
  }, [fetchLobby, normalizedRoomCode]);

  const scheduleLobbyRefetch = useCallback(
    (delayMs = 250) => {
      if (refetchTimerRef.current) {
        window.clearTimeout(refetchTimerRef.current);
      }

      refetchTimerRef.current = window.setTimeout(() => {
        refetchTimerRef.current = null;
        fetchLobby(session).catch((refetchError) => {
          setLiveStatus("reconnecting");
          setError(refetchError instanceof Error ? refetchError.message : "Unable to refresh lobby.");
        });
      }, delayMs);
    },
    [fetchLobby, session],
  );

  useEffect(() => {
    if (!lobbyState?.room.id) {
      return undefined;
    }

    setLiveStatus("connecting");

    const channel = supabase
      .channel(`lobby:${lobbyState.room.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "players", filter: `room_id=eq.${lobbyState.room.id}` },
        () => scheduleLobbyRefetch(),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "rooms", filter: `id=eq.${lobbyState.room.id}` },
        () => scheduleLobbyRefetch(),
      )
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          setLiveStatus("live");
          return;
        }

        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          setLiveStatus("reconnecting");
          scheduleLobbyRefetch(0);
          return;
        }

        if (status === "CLOSED") {
          setLiveStatus("offline");
        }
      });

    const fallbackIntervalId = window.setInterval(() => {
      if (Date.now() - lastRefetchAtRef.current > 30000) {
        scheduleLobbyRefetch(0);
      }
    }, 15000);

    return () => {
      window.clearInterval(fallbackIntervalId);

      if (refetchTimerRef.current) {
        window.clearTimeout(refetchTimerRef.current);
        refetchTimerRef.current = null;
      }

      supabase.removeChannel(channel);
      setLiveStatus("offline");
    };
  }, [lobbyState?.room.id, scheduleLobbyRefetch, supabase]);

  useEffect(() => {
    if (liveStatus !== "reconnecting") {
      if (reconnectTimerRef.current) {
        window.clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }

      return undefined;
    }

    reconnectTimerRef.current = window.setTimeout(() => scheduleLobbyRefetch(0), 3000);

    return () => {
      if (reconnectTimerRef.current) {
        window.clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
    };
  }, [liveStatus, scheduleLobbyRefetch]);

  const activePlayerCount = useMemo(
    () => lobbyState?.players.filter((player) => player.status !== "left").length ?? 0,
    [lobbyState?.players],
  );

  async function postLobbyAction(path: string, body: Record<string, unknown>) {
    if (!session) {
      throw new Error("This browser does not have a matching player session for this room.");
    }

    const response = await fetch(path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...body,
        playerId: session.playerId,
        sessionToken: session.sessionToken,
      }),
    });
    const data = await parseJsonResponse<LobbyState>(response, "The server returned an empty action response.");

    if (!response.ok) {
      throw new Error(data.error ?? "Action failed.");
    }

    if (!data.room || !data.players) {
      throw new Error(data.error ?? "The server response was missing lobby details.");
    }

    setLobbyState(data);
    setError(null);
  }

  async function handleToggleReady() {
    if (!lobbyState?.currentPlayer) {
      return;
    }

    setIsSubmitting(true);

    try {
      await postLobbyAction(`/api/rooms/${normalizedRoomCode}/ready`, {
        isReady: !lobbyState.currentPlayer.is_ready,
      });
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "Unable to update ready status.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleStartGame() {
    setIsSubmitting(true);

    try {
      await postLobbyAction(`/api/rooms/${normalizedRoomCode}/start`, {});
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "Unable to start game.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleRefresh() {
    setIsLoading(true);

    try {
      await fetchLobby(session);
    } catch (refreshError) {
      setError(refreshError instanceof Error ? refreshError.message : "Unable to refresh lobby.");
    } finally {
      setIsLoading(false);
    }
  }

  if (isLoading && !lobbyState) {
    return (
      <main className="flex min-h-screen items-center justify-center px-5 py-10">
        <PixelPanel className="max-w-xl p-8 text-center" tone="sky">
          <h1 className="text-4xl font-black">Loading Room...</h1>
          <p className="mt-3 font-semibold text-[#4d3b61]">Fetching the latest lobby state.</p>
        </PixelPanel>
      </main>
    );
  }

  if (!lobbyState) {
    return (
      <main className="flex min-h-screen items-center justify-center px-5 py-10">
        <PixelPanel className="max-w-xl p-8 text-center" tone="lavender">
          <h1 className="text-4xl font-black">Room Not Found</h1>
          <p className="mt-3 font-semibold text-[#4d3b61]">{error ?? "This room could not be loaded."}</p>
          <Link className="mt-6 inline-block" href="/">
            <PixelButton>Back Home</PixelButton>
          </Link>
        </PixelPanel>
      </main>
    );
  }

  const currentPlayer = lobbyState.currentPlayer;
  const isCurrentHost = Boolean(currentPlayer?.is_host);
  const isWaiting = lobbyState.room.status === "waiting";

  return (
    <main className="min-h-screen px-5 py-8 sm:px-8 lg:px-12">
      <section className="mx-auto grid max-w-7xl gap-6 lg:grid-cols-[0.9fr_1.1fr]">
        <PixelPanel className="p-6" tone="lavender">
          <p className="mb-2 text-xs font-black uppercase tracking-[0.22em] text-[#5a4770]">Lobby</p>
          <h1 className="text-5xl font-black tracking-[-0.06em] sm:text-7xl">{lobbyState.room.room_code}</h1>
          <div className="mt-6 grid gap-3 text-sm font-bold text-[#4d3b61]">
            <p className="pixel-border bg-[#fff7df] p-3">Status: {statusLabel(lobbyState.room.status)}</p>
            <p className={`pixel-border p-3 ${liveStatusClassName(liveStatus)}`}>
              Lobby sync: {liveStatusLabel(liveStatus)}
            </p>
            <p className="pixel-border bg-[#fff7df] p-3">
              Players: {activePlayerCount}/{lobbyState.room.max_players}
            </p>
            <p className="pixel-border bg-[#fff7df] p-3">
              Your seat: {currentPlayer ? `Seat ${currentPlayer.seat_no}` : "No matching session in this browser"}
            </p>
          </div>
          {error ? <p className="pixel-border mt-5 bg-[#ff9aa2] p-3 text-sm font-bold">{error}</p> : null}
          {!currentPlayer ? (
            <p className="pixel-border mt-5 bg-[#ffd166] p-3 text-sm font-bold">
              This browser does not have a matching local player session. You can watch the lobby, or return home to
              create/join with this browser.
            </p>
          ) : null}
          <div className="mt-6 flex flex-wrap gap-3">
            <PixelButton disabled={isLoading || isSubmitting} onClick={handleRefresh} variant="secondary">
              Refresh
            </PixelButton>
            <Link href="/">
              <PixelButton variant="accent">Home</PixelButton>
            </Link>
          </div>
          <p className="mt-5 text-xs font-bold text-[#5a4770]">
            Lobby updates come from Supabase Realtime and refetch server-validated room state. A slow polling fallback
            helps recover after reconnects.
          </p>
        </PixelPanel>

        <div className="space-y-6">
          <PixelPanel className="p-6" tone="paper">
            <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.2em] text-[#5a4770]">Players</p>
                <h2 className="text-3xl font-black">Lobby Seats</h2>
              </div>
              <span className="pixel-border bg-[#ffd166] px-4 py-2 text-sm font-black uppercase">
                Max {lobbyState.room.max_players}
              </span>
            </div>
            <div className="grid gap-3">
              {lobbyState.players.map((player) => (
                <PixelCard
                  key={player.id}
                  className={player.id === currentPlayer?.id ? "bg-[#b8f2d0]" : "bg-[#fff2cc]"}
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-xs font-black uppercase tracking-[0.16em] text-[#6c557d]">
                        Seat {player.seat_no} · {player.avatar_key.replaceAll("_", " ")}
                      </p>
                      <h3 className="text-2xl font-black">{player.display_name}</h3>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {player.id === currentPlayer?.id ? (
                        <span className="pixel-border bg-[#a0d8ff] px-3 py-2 text-xs font-black uppercase">You</span>
                      ) : null}
                      <span className="pixel-border bg-white px-3 py-2 text-xs font-black uppercase">
                        {getPlayerBadge(player)}
                      </span>
                    </div>
                  </div>
                </PixelCard>
              ))}
            </div>
          </PixelPanel>

          <PixelPanel className="p-6" tone="mint">
            <p className="text-xs font-black uppercase tracking-[0.2em] text-[#5a4770]">Actions</p>
            <h2 className="mb-4 text-3xl font-black">Ready Check</h2>
            {!currentPlayer ? (
              <p className="pixel-border bg-[#fff7df] p-4 font-bold text-[#4d3b61]">
                This browser does not have a verified player session for this room. Create or join the room from this browser to use lobby controls.
              </p>
            ) : isCurrentHost ? (
              <div className="space-y-4">
                <p className="font-bold text-[#4d3b61]">
                  Hosts can start once there are 2-4 players and all non-host players are ready.
                </p>
                <ul className="grid gap-2 text-sm font-bold text-[#4d3b61]">
                  <li>Waiting room: {lobbyState.startRequirements.isWaiting ? "Yes" : "No"}</li>
                  <li>2-4 players: {lobbyState.startRequirements.hasEnoughPlayers && lobbyState.startRequirements.hasRoomCapacity ? "Yes" : "No"}</li>
                  <li>All non-hosts ready: {lobbyState.startRequirements.allNonHostsReady ? "Yes" : "No"}</li>
                </ul>
                <PixelButton
                  className="w-full"
                  disabled={!lobbyState.canStartGame || isSubmitting || !isWaiting}
                  onClick={handleStartGame}
                >
                  {lobbyState.room.status === "playing" ? "Game Started" : isSubmitting ? "Starting..." : "Start Game"}
                </PixelButton>
              </div>
            ) : (
              <div className="space-y-4">
                <p className="font-bold text-[#4d3b61]">
                  Toggle ready when you are set. The host can start after every non-host player is ready.
                </p>
                <PixelButton
                  className="w-full"
                  disabled={isSubmitting || !isWaiting}
                  onClick={handleToggleReady}
                  variant={currentPlayer.is_ready ? "accent" : "primary"}
                >
                  {isSubmitting ? "Saving..." : currentPlayer.is_ready ? "Mark Not Ready" : "Mark Ready"}
                </PixelButton>
              </div>
            )}
          </PixelPanel>
        </div>
      </section>
    </main>
  );
}
