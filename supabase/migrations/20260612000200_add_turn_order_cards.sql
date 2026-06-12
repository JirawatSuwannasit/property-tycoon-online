-- Add server-authoritative turn-order card draw fields for Phase 6.5.
-- The server assigns unique cards when the host starts the game; clients only display them.

alter table public.players
  add column if not exists turn_order_card integer null,
  add column if not exists play_order integer null;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'players_turn_order_card_check'
  ) then
    alter table public.players
      add constraint players_turn_order_card_check
      check (turn_order_card is null or turn_order_card between 1 and 4);
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'players_play_order_check'
  ) then
    alter table public.players
      add constraint players_play_order_check
      check (play_order is null or play_order between 1 and 4);
  end if;
end $$;

create unique index if not exists players_room_turn_order_card_unique_idx
  on public.players (room_id, turn_order_card)
  where turn_order_card is not null;

create unique index if not exists players_room_play_order_unique_idx
  on public.players (room_id, play_order)
  where play_order is not null;

comment on column public.players.turn_order_card is
  'Server-assigned random turn-order card from 1 to 4. Lowest card plays first.';

comment on column public.players.play_order is
  'Server-assigned play order derived from turn_order_card. 1 plays first.';

-- Browser clients may observe these public lobby/game fields through realtime payloads.
-- The service-role key is still required for writes and must never be exposed to the browser.
grant select (turn_order_card, play_order) on table public.players to anon, authenticated;
