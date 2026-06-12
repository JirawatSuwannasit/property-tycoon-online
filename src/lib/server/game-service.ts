import { randomInt } from "crypto";
import { NextResponse } from "next/server";
import type { Database, Json, PendingAction, TurnPhase } from "@/lib/database.types";
import { MVP_BOARD_SIZE, START_TILE_INDEX, JAIL_TILE_INDEX } from "@/lib/game/schema";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { hashSessionToken, isValidRoomCode, normalizeRoomCode } from "./session";

type SupabaseAdmin = ReturnType<typeof createSupabaseAdminClient>;
type RoomRow = Database["public"]["Tables"]["rooms"]["Row"];
type PlayerRow = Database["public"]["Tables"]["players"]["Row"];
type TileRow = Database["public"]["Tables"]["game_tiles"]["Row"];
type PropertyRow = Database["public"]["Tables"]["properties"]["Row"];
type GameEventRow = Database["public"]["Tables"]["game_events"]["Row"];
type GamePlayerState = Omit<PlayerRow, "session_token_hash"> & {
  is_current_turn: boolean;
  is_you: boolean;
};

type GameStateHints = {
  canRoll: boolean;
  canBuy: boolean;
  canUpgrade: boolean;
  canSellUpgrade: boolean;
  canSellProperty: boolean;
  canSkipDecision: boolean;
  secondsRemaining: number;
};

type PendingDecisionState = {
  action: PendingAction;
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

export type GameState = {
  room: Pick<
    RoomRow,
    | "id"
    | "room_code"
    | "status"
    | "turn_phase"
    | "action_deadline_at"
    | "pending_action"
    | "pending_tile_id"
    | "current_turn_player_id"
    | "winner_player_id"
    | "turn_number"
  > & { current_turn_player_name: string | null };
  players: GamePlayerState[];
  tiles: TileRow[];
  properties: PropertyRow[];
  events: GameEventRow[];
  pendingTile: TileRow | null;
  pendingDecision: PendingDecisionState | null;
  winner: GamePlayerState | null;
  hints: GameStateHints;
};

export class GameApiError extends Error {
  constructor(
    message: string,
    public readonly code = "GAME_ERROR",
    public readonly status = 400,
  ) {
    super(message);
  }
}

export function gameOk(state: GameState, message: string) {
  return NextResponse.json({ ok: true, state, message });
}

export function handleGameApiError(error: unknown) {
  if (error instanceof GameApiError) {
    return NextResponse.json({ ok: false, error: error.message, code: error.code }, { status: error.status });
  }

  console.error("Game API error", error);
  return NextResponse.json(
    { ok: false, error: error instanceof Error ? error.message : "Unexpected game API error.", code: "INTERNAL_ERROR" },
    { status: 500 },
  );
}

export async function parseGameActionBody(request: Request): Promise<{ playerId: string; sessionToken: string }> {
  const body = (await request.json().catch(() => null)) as { playerId?: string; sessionToken?: string } | null;

  if (!body?.playerId || !body.sessionToken) {
    throw new GameApiError("Missing player session.", "MISSING_SESSION", 401);
  }

  return { playerId: body.playerId, sessionToken: body.sessionToken };
}

function deadlineFromNow(seconds = 30) {
  return new Date(Date.now() + seconds * 1000).toISOString();
}

function secondsRemaining(deadline: string | null) {
  if (!deadline) {
    return 0;
  }

  return Math.max(0, Math.ceil((new Date(deadline).getTime() - Date.now()) / 1000));
}

function rollDie() {
  return randomInt(1, 7);
}

function upgradeCost(tile: TileRow, nextLevel: number) {
  const price = tile.price ?? 0;
  const multiplier = nextLevel === 1 ? 0.5 : nextLevel === 2 ? 0.75 : 1;
  return Math.ceil(price * multiplier);
}

function sellPropertyRefund(tile: TileRow) {
  return Math.floor((tile.price ?? 0) * 0.5);
}

function sellUpgradeRefund(tile: TileRow, currentUpgradeLevel: number) {
  return Math.floor(upgradeCost(tile, currentUpgradeLevel) * 0.5);
}

function rentFor(tile: TileRow, property: PropertyRow) {
  return (tile.rent ?? 0) * (1 + property.upgrade_level);
}

function activePlayers(players: PlayerRow[]) {
  return players
    .filter((player) => player.status === "active")
    .sort((a, b) => (a.play_order ?? 99) - (b.play_order ?? 99) || a.seat_no - b.seat_no);
}

function nextActivePlayerId(players: PlayerRow[], currentPlayerId: string) {
  const active = activePlayers(players);

  if (active.length === 0) {
    return null;
  }

  const currentIndex = active.findIndex((player) => player.id === currentPlayerId);
  const nextIndex = currentIndex === -1 ? 0 : (currentIndex + 1) % active.length;
  return active[nextIndex]?.id ?? null;
}

function winnerPlayer(players: PlayerRow[]) {
  const active = activePlayers(players);
  return active.length === 1 ? active[0] : null;
}

async function loadRoomByCode(supabase: SupabaseAdmin, roomCode: string) {
  const normalizedRoomCode = normalizeRoomCode(roomCode);

  if (!isValidRoomCode(normalizedRoomCode)) {
    throw new GameApiError("Room code must be 6 uppercase letters or numbers.", "INVALID_ROOM_CODE", 400);
  }

  const { data: room, error } = await supabase
    .from("rooms")
    .select("*")
    .eq("room_code", normalizedRoomCode)
    .single();

  if (error || !room) {
    throw new GameApiError("Room not found.", "ROOM_NOT_FOUND", 404);
  }

  return room as RoomRow;
}

async function loadRoomById(supabase: SupabaseAdmin, roomId: string) {
  const { data: room, error } = await supabase.from("rooms").select("*").eq("id", roomId).single();

  if (error || !room) {
    throw new GameApiError("Room not found.", "ROOM_NOT_FOUND", 404);
  }

  return room as RoomRow;
}

async function loadPlayers(supabase: SupabaseAdmin, roomId: string) {
  const { data, error } = await supabase
    .from("players")
    .select("*")
    .eq("room_id", roomId)
    .order("seat_no", { ascending: true });

  if (error || !data) {
    throw new GameApiError(error?.message ?? "Unable to load players.", "PLAYERS_LOAD_FAILED", 500);
  }

  return data as PlayerRow[];
}

async function loadTiles(supabase: SupabaseAdmin) {
  const { data, error } = await supabase.from("game_tiles").select("*").order("tile_index", { ascending: true });

  if (error || !data) {
    throw new GameApiError(error?.message ?? "Unable to load board tiles.", "TILES_LOAD_FAILED", 500);
  }

  return data as TileRow[];
}

async function loadProperties(supabase: SupabaseAdmin, roomId: string) {
  const { data, error } = await supabase.from("properties").select("*").eq("room_id", roomId);

  if (error || !data) {
    throw new GameApiError(error?.message ?? "Unable to load properties.", "PROPERTIES_LOAD_FAILED", 500);
  }

  return data as PropertyRow[];
}

export async function writeGameEvent(
  supabase: SupabaseAdmin,
  roomId: string,
  playerId: string | null,
  eventType: string,
  message: string,
  payload: Json = {},
) {
  const { error } = await supabase.from("game_events").insert({
    room_id: roomId,
    player_id: playerId,
    event_type: eventType,
    message,
    payload,
  });

  if (error) {
    throw new GameApiError(error.message, "EVENT_WRITE_FAILED", 500);
  }
}

export async function saveGameSnapshot(supabase: SupabaseAdmin, roomId: string, state: Json) {
  const { data: latest } = await supabase
    .from("game_snapshots")
    .select("version")
    .eq("room_id", roomId)
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();

  const version = ((latest?.version as number | undefined) ?? 0) + 1;
  const { error } = await supabase.from("game_snapshots").insert({ room_id: roomId, version, state });

  if (error) {
    throw new GameApiError(error.message, "SNAPSHOT_WRITE_FAILED", 500);
  }
}

async function serializeGameState(supabase: SupabaseAdmin, room: RoomRow, currentPlayerId?: string | null): Promise<GameState> {
  const [players, tiles, properties, eventsResult] = await Promise.all([
    loadPlayers(supabase, room.id),
    loadTiles(supabase),
    loadProperties(supabase, room.id),
    supabase
      .from("game_events")
      .select("*")
      .eq("room_id", room.id)
      .order("created_at", { ascending: false })
      .limit(30),
  ]);

  if (eventsResult.error || !eventsResult.data) {
    throw new GameApiError(eventsResult.error?.message ?? "Unable to load game events.", "EVENTS_LOAD_FAILED", 500);
  }

  const viewerId = currentPlayerId ?? null;
  const publicPlayers = players
    .map(({ session_token_hash: _sessionTokenHash, ...player }) => ({
      ...player,
      is_current_turn: player.id === room.current_turn_player_id,
      is_you: player.id === viewerId,
    }))
    .sort((a, b) => (a.play_order ?? 99) - (b.play_order ?? 99) || a.seat_no - b.seat_no) as GamePlayerState[];
  const pendingTile = room.pending_tile_id ? tiles.find((tile) => tile.id === room.pending_tile_id) ?? null : null;
  const winner = room.winner_player_id ? publicPlayers.find((player) => player.id === room.winner_player_id) ?? null : null;
  const currentTurnPlayer = publicPlayers.find((player) => player.id === room.current_turn_player_id) ?? null;
  const viewerIsCurrent = Boolean(viewerId && viewerId === room.current_turn_player_id);
  const pendingProperty = room.pending_tile_id
    ? properties.find((property) => property.room_id === room.id && property.tile_id === room.pending_tile_id) ?? null
    : null;
  const canActOnPending = viewerIsCurrent && room.turn_phase === "waiting_to_buy_or_upgrade";
  const viewer = publicPlayers.find((player) => player.id === viewerId) ?? null;
  const pendingDecision =
    room.turn_phase === "waiting_to_buy_or_upgrade" && room.pending_action && pendingTile
      ? (() => {
          const currentUpgradeLevel = pendingProperty?.upgrade_level ?? null;
          const nextUpgradeLevel = currentUpgradeLevel == null ? null : currentUpgradeLevel + 1;
          const computedUpgradeCost =
            room.pending_action === "upgrade_property" && nextUpgradeLevel != null && nextUpgradeLevel <= 3
              ? upgradeCost(pendingTile, nextUpgradeLevel)
              : null;
          const computedCurrentRent = pendingProperty ? rentFor(pendingTile, pendingProperty) : pendingTile.rent;
          const computedNewRent =
            room.pending_action === "upgrade_property" && nextUpgradeLevel != null && pendingTile.rent != null
              ? pendingTile.rent * (1 + nextUpgradeLevel)
              : null;
          const computedSellUpgradeRefund =
            room.pending_action === "upgrade_property" && currentUpgradeLevel != null && currentUpgradeLevel > 0
              ? sellUpgradeRefund(pendingTile, currentUpgradeLevel)
              : null;
          const computedSellPropertyRefund =
            room.pending_action === "upgrade_property" && currentUpgradeLevel === 0 ? sellPropertyRefund(pendingTile) : null;

          return {
            action: room.pending_action,
            tileId: pendingTile.id,
            tileName: pendingTile.name,
            tileIndex: pendingTile.tile_index,
            price: pendingTile.price,
            baseRent: pendingTile.rent,
            ownerPlayerId: pendingProperty?.owner_player_id ?? null,
            currentUpgradeLevel,
            currentRent: computedCurrentRent,
            upgradeCost: computedUpgradeCost,
            newRent: computedNewRent,
            sellUpgradeRefund: computedSellUpgradeRefund,
            sellPropertyRefund: computedSellPropertyRefund,
            secondsRemaining: secondsRemaining(room.action_deadline_at),
          };
        })()
      : null;

  return {
    room: {
      id: room.id,
      room_code: room.room_code,
      status: room.status,
      turn_phase: room.turn_phase,
      action_deadline_at: room.action_deadline_at,
      pending_action: room.pending_action,
      pending_tile_id: room.pending_tile_id,
      current_turn_player_id: room.current_turn_player_id,
      current_turn_player_name: currentTurnPlayer?.display_name ?? null,
      winner_player_id: room.winner_player_id,
      turn_number: room.turn_number,
    },
    players: publicPlayers,
    tiles,
    properties,
    events: eventsResult.data as GameEventRow[],
    pendingTile,
    pendingDecision,
    winner,
    hints: {
      canRoll: viewerIsCurrent && room.status === "playing" && room.turn_phase === "waiting_to_roll",
      canBuy:
        canActOnPending &&
        room.pending_action === "buy_property" &&
        Boolean(pendingTile && pendingTile.price != null && viewer && viewer.money >= pendingTile.price),
      canUpgrade:
        canActOnPending &&
        room.pending_action === "upgrade_property" &&
        Boolean(
          pendingProperty &&
            pendingProperty.owner_player_id === viewerId &&
            pendingProperty.upgrade_level < 3 &&
            pendingDecision?.upgradeCost != null &&
            viewer &&
            viewer.money >= pendingDecision.upgradeCost,
        ),
      canSellUpgrade:
        canActOnPending &&
        room.pending_action === "upgrade_property" &&
        Boolean(
          pendingProperty &&
            pendingProperty.owner_player_id === viewerId &&
            pendingProperty.upgrade_level > 0 &&
            pendingDecision?.sellUpgradeRefund != null,
        ),
      canSellProperty:
        canActOnPending &&
        room.pending_action === "upgrade_property" &&
        Boolean(
          pendingProperty &&
            pendingProperty.owner_player_id === viewerId &&
            pendingProperty.upgrade_level === 0 &&
            pendingDecision?.sellPropertyRefund != null,
        ),
      canSkipDecision: canActOnPending,
      secondsRemaining: secondsRemaining(room.action_deadline_at),
    },
  };
}

export async function getGameStateByRoomCode(roomCode: string, currentPlayerId?: string | null) {
  const supabase = createSupabaseAdminClient();
  const room = await loadRoomByCode(supabase, roomCode);

  if (room.status === "playing") {
    await resolveExpiredTurnAction(room.id);
  }

  const updatedRoom = await loadRoomById(supabase, room.id);
  return serializeGameState(supabase, updatedRoom, currentPlayerId);
}

export async function requireGamePlayerSession(roomCode: string, playerId: string, sessionToken: string) {
  const supabase = createSupabaseAdminClient();
  const room = await loadRoomByCode(supabase, roomCode);
  const tokenHash = hashSessionToken(sessionToken);
  const { data: player, error } = await supabase
    .from("players")
    .select("*")
    .eq("room_id", room.id)
    .eq("id", playerId)
    .eq("session_token_hash", tokenHash)
    .single();

  if (error || !player) {
    throw new GameApiError("Invalid player session.", "INVALID_SESSION", 401);
  }

  return { supabase, room, player: player as PlayerRow };
}

function assertPlaying(room: RoomRow) {
  if (room.status !== "playing") {
    throw new GameApiError("Room is not currently playing.", "ROOM_NOT_PLAYING", 409);
  }
}

function assertCurrentPlayer(room: RoomRow, playerId: string) {
  if (room.current_turn_player_id !== playerId) {
    throw new GameApiError("It is not this player's turn.", "NOT_CURRENT_TURN", 403);
  }
}

function assertDeadlineActive(room: RoomRow) {
  if (room.action_deadline_at && new Date(room.action_deadline_at).getTime() <= Date.now()) {
    throw new GameApiError("Action deadline has expired. Resolve timeout first.", "DEADLINE_EXPIRED", 409);
  }
}

async function updatePlayerMoneyAndStatus(supabase: SupabaseAdmin, player: PlayerRow, money: number) {
  const status = money < 0 ? "bankrupt" : player.status;
  const { error } = await supabase.from("players").update({ money, status }).eq("id", player.id);

  if (error) {
    throw new GameApiError(error.message, "PLAYER_UPDATE_FAILED", 500);
  }

  return { ...player, money, status } as PlayerRow;
}

async function maybeFinishOrAdvanceTurn(supabase: SupabaseAdmin, room: RoomRow, currentPlayerId: string) {
  const players = await loadPlayers(supabase, room.id);
  const winner = winnerPlayer(players);

  if (winner) {
    const { error } = await supabase
      .from("rooms")
      .update({
        status: "finished",
        turn_phase: "finished",
        winner_player_id: winner.id,
        action_deadline_at: null,
        pending_tile_id: null,
        pending_action: null,
      })
      .eq("id", room.id);

    if (error) {
      throw new GameApiError(error.message, "ROOM_FINISH_FAILED", 500);
    }

    await writeGameEvent(supabase, room.id, winner.id, "winner_detected", `${winner.display_name} wins the game!`);
    return;
  }

  const nextPlayerId = nextActivePlayerId(players, currentPlayerId);

  if (!nextPlayerId) {
    throw new GameApiError("No active player is available for the next turn.", "NO_ACTIVE_PLAYER", 409);
  }

  const { error } = await supabase
    .from("rooms")
    .update({
      current_turn_player_id: nextPlayerId,
      turn_number: room.turn_number + 1,
      turn_phase: "waiting_to_roll",
      action_deadline_at: deadlineFromNow(),
      pending_tile_id: null,
      pending_action: null,
    })
    .eq("id", room.id);

  if (error) {
    throw new GameApiError(error.message, "ADVANCE_TURN_FAILED", 500);
  }

  const nextPlayer = players.find((player) => player.id === nextPlayerId);
  await writeGameEvent(supabase, room.id, nextPlayerId, "turn_started", `${nextPlayer?.display_name ?? "Next player"}'s turn started.`);
}

async function resolveLanding(supabase: SupabaseAdmin, room: RoomRow, player: PlayerRow, tile: TileRow, startBonus: number) {
  let updatedPlayer = player;
  let money = player.money + startBonus;
  const positionUpdate: Partial<PlayerRow> = { position: tile.tile_index };

  if (tile.type === "tax" || tile.type === "bonus" || tile.type === "start") {
    money += tile.amount ?? 0;
  }

  if (tile.type === "go_to_jail") {
    positionUpdate.position = JAIL_TILE_INDEX;
    positionUpdate.jail_turns = 1;
  }

  const { error: positionError } = await supabase
    .from("players")
    .update({ ...positionUpdate, money, status: money < 0 ? "bankrupt" : player.status })
    .eq("id", player.id);

  if (positionError) {
    throw new GameApiError(positionError.message, "PLAYER_MOVE_FAILED", 500);
  }

  updatedPlayer = { ...player, ...positionUpdate, money, status: money < 0 ? "bankrupt" : player.status } as PlayerRow;

  await writeGameEvent(
    supabase,
    room.id,
    player.id,
    "landed_on_tile",
    `${player.display_name} landed on ${tile.name}.`,
    { tileIndex: tile.tile_index, tileType: tile.type, startBonus },
  );

  if (updatedPlayer.status === "bankrupt") {
    await maybeFinishOrAdvanceTurn(supabase, room, player.id);
    return;
  }

  if (tile.type === "chance") {
    await applyChance(supabase, room, updatedPlayer);
    await maybeFinishOrAdvanceTurn(supabase, room, player.id);
    return;
  }

  if (tile.type !== "property") {
    await maybeFinishOrAdvanceTurn(supabase, room, player.id);
    return;
  }

  const properties = await loadProperties(supabase, room.id);
  const property = properties.find((candidate) => candidate.tile_id === tile.id) ?? null;

  if (!property) {
    await setPendingDecision(supabase, room, tile, "buy_property");
    await writeGameEvent(supabase, room.id, player.id, "buy_decision_started", `${player.display_name} can buy landmark rights for ${tile.name}.`);
    return;
  }

  if (property.owner_player_id === player.id) {
    await setPendingDecision(supabase, room, tile, "upgrade_property");

    if (property.upgrade_level < 3) {
      await writeGameEvent(
        supabase,
        room.id,
        player.id,
        "upgrade_decision_started",
        `${player.display_name} can upgrade visitor facilities or sell at ${tile.name}.`,
        { tileId: tile.id, upgradeLevel: property.upgrade_level },
      );
      return;
    }

    await writeGameEvent(
      supabase,
      room.id,
      player.id,
      "sell_decision_started",
      `${player.display_name} can sell an upgrade at ${tile.name}.`,
      { tileId: tile.id, upgradeLevel: property.upgrade_level },
    );
    return;
  }

  const owner = (await loadPlayers(supabase, room.id)).find((candidate) => candidate.id === property.owner_player_id);
  const rent = rentFor(tile, property);
  const payerAfterRent = updatedPlayer.money - rent;
  await updatePlayerMoneyAndStatus(supabase, updatedPlayer, payerAfterRent);

  if (owner && owner.status === "active") {
    await updatePlayerMoneyAndStatus(supabase, owner, owner.money + rent);
  }

  await writeGameEvent(
    supabase,
    room.id,
    player.id,
    "rent_paid",
    `${player.display_name} paid ${rent} coins in route fees for ${tile.name}.`,
    { rent, tileId: tile.id, ownerPlayerId: property.owner_player_id, upgradeLevel: property.upgrade_level },
  );
  await maybeFinishOrAdvanceTurn(supabase, room, player.id);
}

async function applyChance(supabase: SupabaseAdmin, room: RoomRow, player: PlayerRow) {
  const { data: cards, error } = await supabase.from("chance_cards").select("*");

  if (error || !cards?.length) {
    return;
  }

  const card = cards[randomInt(0, cards.length)];
  let money = player.money;
  let position = player.position;
  let jailTurns = player.jail_turns;

  if (card.type === "receive_money") {
    money += card.amount ?? 0;
  } else if (card.type === "pay_money") {
    money -= card.amount ?? 0;
  } else if (card.type === "move_to_start") {
    position = START_TILE_INDEX;
    money += 200;
  } else if (card.type === "move_steps") {
    position = (position + (card.steps ?? 0) + MVP_BOARD_SIZE) % MVP_BOARD_SIZE;
  } else if (card.type === "go_to_jail") {
    position = card.target_tile_index ?? JAIL_TILE_INDEX;
    jailTurns = 1;
  }

  const status = money < 0 ? "bankrupt" : player.status;
  const { error: updateError } = await supabase.from("players").update({ money, position, jail_turns: jailTurns, status }).eq("id", player.id);

  if (updateError) {
    throw new GameApiError(updateError.message, "CHANCE_UPDATE_FAILED", 500);
  }

  await writeGameEvent(supabase, room.id, player.id, "chance_card", `${player.display_name} drew ${card.title}.`, {
    cardKey: card.card_key,
    cardType: card.type,
  });
}

async function setPendingDecision(supabase: SupabaseAdmin, room: RoomRow, tile: TileRow, pendingAction: PendingAction) {
  const { error } = await supabase
    .from("rooms")
    .update({
      turn_phase: "waiting_to_buy_or_upgrade",
      pending_action: pendingAction,
      pending_tile_id: tile.id,
      action_deadline_at: deadlineFromNow(),
    })
    .eq("id", room.id);

  if (error) {
    throw new GameApiError(error.message, "PENDING_DECISION_FAILED", 500);
  }
}

export async function rollDiceForRoom(roomCode: string, playerId: string, sessionToken: string) {
  const { supabase, room, player } = await requireGamePlayerSession(roomCode, playerId, sessionToken);
  assertPlaying(room);
  await resolveExpiredTurnAction(room.id);
  const currentRoom = await loadRoomById(supabase, room.id);
  assertPlaying(currentRoom);
  assertCurrentPlayer(currentRoom, player.id);

  if (currentRoom.turn_phase !== "waiting_to_roll") {
    throw new GameApiError("Current turn phase does not allow rolling.", "INVALID_TURN_PHASE", 409);
  }

  assertDeadlineActive(currentRoom);
  await performRoll(supabase, currentRoom, player, false);
  const updatedRoom = await loadRoomById(supabase, room.id);
  const state = await serializeGameState(supabase, updatedRoom, player.id);
  await saveGameSnapshot(supabase, room.id, state as unknown as Json);
  return state;
}

async function performRoll(supabase: SupabaseAdmin, room: RoomRow, player: PlayerRow, automatic: boolean) {
  const { data: lockedRoom, error: lockError } = await supabase
    .from("rooms")
    .update({ turn_phase: "resolving_roll" })
    .eq("id", room.id)
    .eq("turn_phase", "waiting_to_roll")
    .select("*")
    .maybeSingle();

  if (lockError || !lockedRoom) {
    throw new GameApiError(lockError?.message ?? "Roll is already being resolved.", "ROLL_LOCK_FAILED", 409);
  }

  const dieOne = rollDie();
  const dieTwo = rollDie();
  const total = dieOne + dieTwo;
  const tiles = await loadTiles(supabase);
  const rawPosition = player.position + total;
  const passedStart = rawPosition >= MVP_BOARD_SIZE;
  const newPosition = rawPosition % MVP_BOARD_SIZE;
  const tile = tiles.find((candidate) => candidate.tile_index === newPosition);

  if (!tile) {
    throw new GameApiError("Landing tile not found.", "TILE_NOT_FOUND", 500);
  }

  await writeGameEvent(
    supabase,
    room.id,
    player.id,
    automatic ? "auto_roll" : "roll_dice",
    `${player.display_name} rolled ${dieOne} + ${dieTwo}.`,
    { dice: [dieOne, dieTwo], total, automatic },
  );

  await resolveLanding(supabase, lockedRoom as RoomRow, player, tile, passedStart ? 200 : 0);
}

export async function buyPendingProperty(roomCode: string, playerId: string, sessionToken: string) {
  const { supabase, room, player } = await requireGamePlayerSession(roomCode, playerId, sessionToken);
  assertPlaying(room);
  await resolveExpiredTurnAction(room.id);
  const currentRoom = await loadRoomById(supabase, room.id);
  assertCurrentPlayer(currentRoom, player.id);
  assertDeadlineActive(currentRoom);

  if (currentRoom.turn_phase !== "waiting_to_buy_or_upgrade" || currentRoom.pending_action !== "buy_property" || !currentRoom.pending_tile_id) {
    throw new GameApiError("No buy decision is pending.", "NO_BUY_PENDING", 409);
  }

  const tiles = await loadTiles(supabase);
  const tile = tiles.find((candidate) => candidate.id === currentRoom.pending_tile_id && candidate.type === "property");

  if (!tile || tile.price == null) {
    throw new GameApiError("Pending tile is not buyable.", "NOT_BUYABLE", 409);
  }

  const properties = await loadProperties(supabase, currentRoom.id);

  if (properties.some((property) => property.tile_id === tile.id)) {
    throw new GameApiError("Property is already owned.", "PROPERTY_OWNED", 409);
  }

  if (player.money < tile.price) {
    throw new GameApiError("Not enough money to buy landmark rights.", "INSUFFICIENT_FUNDS", 409);
  }

  const { error: propertyError } = await supabase.from("properties").insert({
    room_id: currentRoom.id,
    tile_id: tile.id,
    owner_player_id: player.id,
    upgrade_level: 0,
  });

  if (propertyError) {
    throw new GameApiError(propertyError.message, "PROPERTY_PURCHASE_FAILED", 409);
  }

  await updatePlayerMoneyAndStatus(supabase, player, player.money - tile.price);
  await writeGameEvent(supabase, currentRoom.id, player.id, "property_bought", `${player.display_name} bought landmark rights for ${tile.name}.`, {
    tileId: tile.id,
    price: tile.price,
  });
  await maybeFinishOrAdvanceTurn(supabase, currentRoom, player.id);
  const updatedRoom = await loadRoomById(supabase, currentRoom.id);
  const state = await serializeGameState(supabase, updatedRoom, player.id);
  await saveGameSnapshot(supabase, currentRoom.id, state as unknown as Json);
  return state;
}

export async function upgradePendingProperty(roomCode: string, playerId: string, sessionToken: string) {
  const { supabase, room, player } = await requireGamePlayerSession(roomCode, playerId, sessionToken);
  assertPlaying(room);
  await resolveExpiredTurnAction(room.id);
  const currentRoom = await loadRoomById(supabase, room.id);
  assertCurrentPlayer(currentRoom, player.id);
  assertDeadlineActive(currentRoom);

  if (currentRoom.turn_phase !== "waiting_to_buy_or_upgrade" || currentRoom.pending_action !== "upgrade_property" || !currentRoom.pending_tile_id) {
    throw new GameApiError("No upgrade decision is pending.", "NO_UPGRADE_PENDING", 409);
  }

  const tiles = await loadTiles(supabase);
  const tile = tiles.find((candidate) => candidate.id === currentRoom.pending_tile_id && candidate.type === "property");

  if (!tile) {
    throw new GameApiError("Pending tile is not upgradeable.", "NOT_UPGRADEABLE", 409);
  }

  const properties = await loadProperties(supabase, currentRoom.id);
  const property = properties.find((candidate) => candidate.tile_id === tile.id && candidate.owner_player_id === player.id);

  if (!property) {
    throw new GameApiError("Player does not own this property.", "NOT_OWNER", 403);
  }

  if (property.upgrade_level >= 3) {
    throw new GameApiError("Property is already at max upgrade level.", "MAX_UPGRADE", 409);
  }

  const nextLevel = property.upgrade_level + 1;
  const cost = upgradeCost(tile, nextLevel);

  if (player.money < cost) {
    throw new GameApiError("Not enough money to upgrade visitor facilities.", "INSUFFICIENT_FUNDS", 409);
  }

  const { error: upgradeError } = await supabase.from("properties").update({ upgrade_level: nextLevel }).eq("id", property.id).eq("upgrade_level", property.upgrade_level);

  if (upgradeError) {
    throw new GameApiError(upgradeError.message, "UPGRADE_FAILED", 500);
  }

  await updatePlayerMoneyAndStatus(supabase, player, player.money - cost);
  await writeGameEvent(supabase, currentRoom.id, player.id, "property_upgraded", `${player.display_name} upgraded visitor facilities at ${tile.name}.`, {
    tileId: tile.id,
    upgradeLevel: nextLevel,
    cost,
  });
  await maybeFinishOrAdvanceTurn(supabase, currentRoom, player.id);
  const updatedRoom = await loadRoomById(supabase, currentRoom.id);
  const state = await serializeGameState(supabase, updatedRoom, player.id);
  await saveGameSnapshot(supabase, currentRoom.id, state as unknown as Json);
  return state;
}


async function loadOwnedPendingPropertyForSale(supabase: SupabaseAdmin, room: RoomRow, player: PlayerRow) {
  if (room.turn_phase !== "waiting_to_buy_or_upgrade" || !room.pending_tile_id) {
    throw new GameApiError("No own-property decision is pending.", "NO_OWN_PROPERTY_PENDING", 409);
  }

  const tiles = await loadTiles(supabase);
  const tile = tiles.find((candidate) => candidate.id === room.pending_tile_id && candidate.type === "property");

  if (!tile) {
    throw new GameApiError("Pending tile is not a property.", "NOT_PROPERTY", 409);
  }

  const properties = await loadProperties(supabase, room.id);
  const property = properties.find((candidate) => candidate.tile_id === tile.id && candidate.owner_player_id === player.id);

  if (!property) {
    throw new GameApiError("Player does not own this pending property.", "NOT_OWNER", 403);
  }

  return { tile, property };
}

export async function sellPendingUpgrade(roomCode: string, playerId: string, sessionToken: string) {
  const { supabase, room, player } = await requireGamePlayerSession(roomCode, playerId, sessionToken);
  assertPlaying(room);
  await resolveExpiredTurnAction(room.id);
  const currentRoom = await loadRoomById(supabase, room.id);
  assertCurrentPlayer(currentRoom, player.id);
  assertDeadlineActive(currentRoom);

  const { tile, property } = await loadOwnedPendingPropertyForSale(supabase, currentRoom, player);

  if (property.upgrade_level <= 0) {
    throw new GameApiError("No upgrade is available to sell.", "NO_UPGRADE_TO_SELL", 409);
  }

  const refund = sellUpgradeRefund(tile, property.upgrade_level);
  const nextLevel = property.upgrade_level - 1;
  const { error: downgradeError } = await supabase
    .from("properties")
    .update({ upgrade_level: nextLevel })
    .eq("id", property.id)
    .eq("owner_player_id", player.id)
    .eq("upgrade_level", property.upgrade_level);

  if (downgradeError) {
    throw new GameApiError(downgradeError.message, "SELL_UPGRADE_FAILED", 500);
  }

  await updatePlayerMoneyAndStatus(supabase, player, player.money + refund);
  await writeGameEvent(
    supabase,
    currentRoom.id,
    player.id,
    "upgrade_sold",
    `${player.display_name} sold one visitor-facility upgrade at ${tile.name} for ${refund} coins.`,
    { tileId: tile.id, previousUpgradeLevel: property.upgrade_level, upgradeLevel: nextLevel, refund },
  );
  await maybeFinishOrAdvanceTurn(supabase, currentRoom, player.id);
  const updatedRoom = await loadRoomById(supabase, currentRoom.id);
  const state = await serializeGameState(supabase, updatedRoom, player.id);
  await saveGameSnapshot(supabase, currentRoom.id, state as unknown as Json);
  return state;
}

export async function sellPendingProperty(roomCode: string, playerId: string, sessionToken: string) {
  const { supabase, room, player } = await requireGamePlayerSession(roomCode, playerId, sessionToken);
  assertPlaying(room);
  await resolveExpiredTurnAction(room.id);
  const currentRoom = await loadRoomById(supabase, room.id);
  assertCurrentPlayer(currentRoom, player.id);
  assertDeadlineActive(currentRoom);

  const { tile, property } = await loadOwnedPendingPropertyForSale(supabase, currentRoom, player);

  if (property.upgrade_level !== 0) {
    throw new GameApiError("Sell upgrades before selling this property.", "UPGRADES_MUST_BE_SOLD_FIRST", 409);
  }

  const refund = sellPropertyRefund(tile);
  const { error: deleteError } = await supabase
    .from("properties")
    .delete()
    .eq("id", property.id)
    .eq("owner_player_id", player.id)
    .eq("upgrade_level", 0);

  if (deleteError) {
    throw new GameApiError(deleteError.message, "SELL_PROPERTY_FAILED", 500);
  }

  await updatePlayerMoneyAndStatus(supabase, player, player.money + refund);
  await writeGameEvent(
    supabase,
    currentRoom.id,
    player.id,
    "property_sold",
    `${player.display_name} sold landmark rights for ${tile.name} for ${refund} coins.`,
    { tileId: tile.id, refund },
  );
  await maybeFinishOrAdvanceTurn(supabase, currentRoom, player.id);
  const updatedRoom = await loadRoomById(supabase, currentRoom.id);
  const state = await serializeGameState(supabase, updatedRoom, player.id);
  await saveGameSnapshot(supabase, currentRoom.id, state as unknown as Json);
  return state;
}

export async function skipPendingDecision(roomCode: string, playerId: string, sessionToken: string) {
  const { supabase, room, player } = await requireGamePlayerSession(roomCode, playerId, sessionToken);
  assertPlaying(room);
  await resolveExpiredTurnAction(room.id);
  const currentRoom = await loadRoomById(supabase, room.id);
  assertCurrentPlayer(currentRoom, player.id);
  assertDeadlineActive(currentRoom);

  if (currentRoom.turn_phase !== "waiting_to_buy_or_upgrade") {
    throw new GameApiError("No decision can be skipped right now.", "NO_DECISION_PENDING", 409);
  }

  await skipDecisionForRoom(supabase, currentRoom, player, false);
  const updatedRoom = await loadRoomById(supabase, currentRoom.id);
  const state = await serializeGameState(supabase, updatedRoom, player.id);
  await saveGameSnapshot(supabase, currentRoom.id, state as unknown as Json);
  return state;
}

async function skipDecisionForRoom(supabase: SupabaseAdmin, room: RoomRow, player: PlayerRow, automatic: boolean) {
  const { data: lockedRoom, error: lockError } = await supabase
    .from("rooms")
    .update({ turn_phase: "turn_ending", action_deadline_at: null, pending_action: null, pending_tile_id: null })
    .eq("id", room.id)
    .eq("turn_phase", "waiting_to_buy_or_upgrade")
    .select("*")
    .maybeSingle();

  if (lockError || !lockedRoom) {
    throw new GameApiError(lockError?.message ?? "Decision is already being resolved.", "DECISION_LOCK_FAILED", 409);
  }

  await writeGameEvent(
    supabase,
    room.id,
    player.id,
    automatic ? "auto_skip_decision" : "skip_decision",
    `${player.display_name} skipped the ${room.pending_action === "upgrade_property" ? "upgrade" : "buy"} decision.`,
    { pendingAction: room.pending_action, pendingTileId: room.pending_tile_id, automatic },
  );
  await maybeFinishOrAdvanceTurn(supabase, lockedRoom as RoomRow, player.id);
}

export async function resolveExpiredTurnAction(roomId: string) {
  const supabase = createSupabaseAdminClient();
  const room = await loadRoomById(supabase, roomId);

  if (room.status !== "playing" || !room.action_deadline_at || new Date(room.action_deadline_at).getTime() > Date.now()) {
    return false;
  }

  const players = await loadPlayers(supabase, room.id);
  const currentPlayer = players.find((player) => player.id === room.current_turn_player_id);

  if (!currentPlayer || currentPlayer.status !== "active") {
    await maybeFinishOrAdvanceTurn(supabase, room, room.current_turn_player_id ?? players[0]?.id ?? "");
    return true;
  }

  if (room.turn_phase === "waiting_to_roll") {
    try {
      await performRoll(supabase, room, currentPlayer, true);
    } catch (error) {
      if (error instanceof GameApiError && error.code === "ROLL_LOCK_FAILED") {
        return false;
      }

      throw error;
    }

    return true;
  }

  if (room.turn_phase === "waiting_to_buy_or_upgrade") {
    try {
      await skipDecisionForRoom(supabase, room, currentPlayer, true);
    } catch (error) {
      if (error instanceof GameApiError && error.code === "DECISION_LOCK_FAILED") {
        return false;
      }

      throw error;
    }

    return true;
  }

  return false;
}

export async function resolveTimeoutByRoomCode(roomCode: string, currentPlayerId?: string | null) {
  const supabase = createSupabaseAdminClient();
  const room = await loadRoomByCode(supabase, roomCode);
  await resolveExpiredTurnAction(room.id);
  const updatedRoom = await loadRoomById(supabase, room.id);
  return serializeGameState(supabase, updatedRoom, currentPlayerId);
}
