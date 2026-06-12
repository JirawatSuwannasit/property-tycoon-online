import { randomInt } from "crypto";
import { NextResponse } from "next/server";
import { canStartRoom, getLobbyState, validatePlayerSession } from "@/lib/server/room-lobby";
import { STARTING_MONEY } from "@/lib/game/schema";
import { writeGameEvent } from "@/lib/server/game-service";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

type StartRouteContext = {
  params: Promise<{ roomCode: string }>;
};

type StartBody = {
  playerId?: string;
  sessionToken?: string;
};

function shuffleTurnCards() {
  const cards = [1, 2, 3, 4];

  for (let index = cards.length - 1; index > 0; index -= 1) {
    const swapIndex = randomInt(0, index + 1);
    [cards[index], cards[swapIndex]] = [cards[swapIndex], cards[index]];
  }

  return cards;
}

function jsonError(error: unknown, fallbackMessage: string, status = 500) {
  return NextResponse.json(
    { error: error instanceof Error ? error.message : fallbackMessage },
    { status },
  );
}

export async function POST(request: Request, { params }: StartRouteContext) {
  try {
    const { roomCode } = await params;
    const body = (await request.json().catch(() => null)) as StartBody | null;

    if (!body?.playerId || !body.sessionToken) {
      return NextResponse.json({ error: "Missing player session." }, { status: 401 });
    }

    const validated = await validatePlayerSession(roomCode, body.playerId, body.sessionToken);

    if (!validated) {
      return NextResponse.json({ error: "Invalid player session." }, { status: 401 });
    }

    const { lobbyState, player } = validated;

    if (!player.is_host || lobbyState.room.host_player_id !== player.id) {
      return NextResponse.json({ error: "Only the host can start the game." }, { status: 403 });
    }

    if (!canStartRoom(lobbyState.room, lobbyState.players)) {
      return NextResponse.json(
        { error: "Need 2-4 players and all non-host players must be ready before starting." },
        { status: 409 },
      );
    }

    const activePlayers = lobbyState.players
      .filter((candidate) => candidate.status === "active")
      .sort((a, b) => a.seat_no - b.seat_no);

    if (activePlayers.length < 2) {
      return NextResponse.json({ error: "At least two active players are required to start." }, { status: 409 });
    }

    const cards = shuffleTurnCards();
    const drawResults = activePlayers.map((activePlayer, index) => ({
      player: activePlayer,
      card: cards[index] ?? index + 1,
    }));
    const orderedResults = [...drawResults].sort((a, b) => a.card - b.card);
    const firstTurnPlayer = orderedResults[0]?.player;

    if (!firstTurnPlayer) {
      return NextResponse.json({ error: "No players are available to start the game." }, { status: 409 });
    }

    const supabase = createSupabaseAdminClient();
    const deadline = new Date(Date.now() + 30_000).toISOString();

    const { error: clearTurnOrderError } = await supabase
      .from("players")
      .update({ turn_order_card: null, play_order: null })
      .eq("room_id", lobbyState.room.id)
      .eq("status", "active");

    if (clearTurnOrderError) {
      return NextResponse.json({ error: clearTurnOrderError.message }, { status: 500 });
    }

    for (const result of orderedResults) {
      const { error: playerUpdateError } = await supabase
        .from("players")
        .update({
          turn_order_card: result.card,
          play_order: orderedResults.findIndex((orderedResult) => orderedResult.player.id === result.player.id) + 1,
          money: STARTING_MONEY,
          position: 0,
          jail_turns: 0,
          status: "active",
        })
        .eq("id", result.player.id)
        .eq("room_id", lobbyState.room.id);

      if (playerUpdateError) {
        return NextResponse.json({ error: playerUpdateError.message }, { status: 500 });
      }
    }

    const { error } = await supabase
      .from("rooms")
      .update({
        status: "playing",
        current_turn_player_id: firstTurnPlayer.id,
        turn_phase: "waiting_to_roll",
        action_deadline_at: deadline,
        pending_action: null,
        pending_tile_id: null,
      })
      .eq("id", lobbyState.room.id)
      .eq("status", "waiting")
      .select("id")
      .single();

    if (error) {
      return NextResponse.json(
        { error: error.code === "PGRST116" ? "Room was already started by another request." : error.message },
        { status: error.code === "PGRST116" ? 409 : 500 },
      );
    }

    await writeGameEvent(supabase, lobbyState.room.id, null, "turn_order_drawn", "Turn-order cards were drawn by the server.", {
      results: orderedResults.map((result, index) => ({
        playerId: result.player.id,
        displayName: result.player.display_name,
        turnOrderCard: result.card,
        playOrder: index + 1,
      })),
    });

    await writeGameEvent(
      supabase,
      lobbyState.room.id,
      firstTurnPlayer.id,
      "game_started",
      `Game started. ${firstTurnPlayer.display_name} drew the lowest card and plays first.`,
      {
        firstTurnPlayerId: firstTurnPlayer.id,
        firstTurnPlayerName: firstTurnPlayer.display_name,
        deadline,
      },
    );

    const updatedLobbyState = await getLobbyState(roomCode, {
      playerId: body.playerId,
      sessionToken: body.sessionToken,
    });

    return NextResponse.json(updatedLobbyState);
  } catch (error) {
    console.error("Room API error", error);
    return jsonError(error, "Unable to start game.");
  }
}
