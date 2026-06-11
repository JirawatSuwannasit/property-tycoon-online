-- Property Tycoon Online Phase 2 MVP schema.
-- This project is an original property trading game and does not use Monopoly
-- names, branding, board layout, card wording, artwork, or protected assets.
-- RLS policies are intentionally not added in Phase 2; authorization and
-- hardening rules will be implemented in a later phase.

create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table public.rooms (
  id uuid primary key default gen_random_uuid(),
  room_code text not null unique,
  status text not null default 'waiting',
  max_players integer not null default 4,
  host_player_id uuid null,
  current_turn_player_id uuid null,
  winner_player_id uuid null,
  turn_number integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint rooms_room_code_format_check
    check (room_code ~ '^[A-Z0-9]{6}$'),
  constraint rooms_status_check
    check (status in ('waiting', 'playing', 'finished')),
  constraint rooms_max_players_check
    check (max_players between 2 and 4),
  constraint rooms_turn_number_check
    check (turn_number >= 0)
);

create index rooms_status_idx on public.rooms (status);
create index rooms_created_at_idx on public.rooms (created_at desc);

create trigger set_rooms_updated_at
before update on public.rooms
for each row
execute function public.set_updated_at();

create table public.players (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms(id) on delete cascade,
  display_name text not null,
  avatar_key text not null,
  seat_no integer not null,
  is_host boolean not null default false,
  is_ready boolean not null default false,
  money integer not null default 1500,
  position integer not null default 0,
  status text not null default 'active',
  jail_turns integer not null default 0,
  session_token_hash text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint players_display_name_length_check
    check (char_length(trim(display_name)) between 1 and 32),
  constraint players_avatar_key_length_check
    check (char_length(trim(avatar_key)) between 1 and 48),
  constraint players_seat_no_check
    check (seat_no between 1 and 4),
  constraint players_status_check
    check (status in ('active', 'bankrupt', 'left')),
  constraint players_money_check
    check (money >= -9999),
  constraint players_position_check
    check (position between 0 and 23),
  constraint players_jail_turns_check
    check (jail_turns >= 0)
);

comment on column public.players.session_token_hash is
  'Nullable in Phase 2. Phase 3 will use this hash for player session validation.';

alter table public.players
  add constraint players_room_id_seat_no_key unique (room_id, seat_no);

alter table public.players
  add constraint players_id_room_id_key unique (id, room_id);

create index players_room_id_idx on public.players (room_id);
create index players_room_id_status_idx on public.players (room_id, status);
create index players_session_token_hash_idx on public.players (session_token_hash)
  where session_token_hash is not null;

create trigger set_players_updated_at
before update on public.players
for each row
execute function public.set_updated_at();

alter table public.rooms
  add constraint rooms_host_player_id_fkey
  foreign key (host_player_id) references public.players(id)
  on delete set null;

alter table public.rooms
  add constraint rooms_current_turn_player_id_fkey
  foreign key (current_turn_player_id) references public.players(id)
  on delete set null;

alter table public.rooms
  add constraint rooms_winner_player_id_fkey
  foreign key (winner_player_id) references public.players(id)
  on delete set null;

create table public.game_tiles (
  id uuid primary key default gen_random_uuid(),
  tile_index integer not null unique,
  type text not null,
  name text not null,
  description text null,
  price integer null,
  rent integer null,
  amount integer null,
  color_group text null,
  created_at timestamptz not null default now(),

  constraint game_tiles_tile_index_check
    check (tile_index between 0 and 23),
  constraint game_tiles_type_check
    check (type in ('start', 'property', 'tax', 'chance', 'jail', 'go_to_jail', 'bonus')),
  constraint game_tiles_name_length_check
    check (char_length(trim(name)) between 1 and 64),
  constraint game_tiles_price_check
    check (price is null or price > 0),
  constraint game_tiles_rent_check
    check (rent is null or rent > 0),
  constraint game_tiles_property_values_check
    check (
      (type = 'property' and price is not null and rent is not null)
      or
      (type <> 'property' and price is null and rent is null)
    ),
  constraint game_tiles_color_group_check
    check (
      color_group is null
      or color_group in ('mint', 'sky', 'coral', 'lavender', 'leaf', 'gold')
    )
);

create index game_tiles_type_idx on public.game_tiles (type);
create index game_tiles_color_group_idx on public.game_tiles (color_group)
  where color_group is not null;

create table public.properties (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms(id) on delete cascade,
  tile_id uuid not null references public.game_tiles(id) on delete restrict,
  owner_player_id uuid not null references public.players(id) on delete cascade,
  purchased_at timestamptz not null default now(),

  constraint properties_room_id_tile_id_key unique (room_id, tile_id)
);

create index properties_room_id_idx on public.properties (room_id);
create index properties_owner_player_id_idx on public.properties (owner_player_id);
create index properties_tile_id_idx on public.properties (tile_id);

create or replace function public.validate_property_purchase()
returns trigger
language plpgsql
as $$
declare
  tile_kind text;
  player_room_id uuid;
begin
  select type into tile_kind
  from public.game_tiles
  where id = new.tile_id;

  if tile_kind is distinct from 'property' then
    raise exception 'Only property tiles can be owned';
  end if;

  select room_id into player_room_id
  from public.players
  where id = new.owner_player_id;

  if player_room_id is distinct from new.room_id then
    raise exception 'Property owner must belong to the same room';
  end if;

  return new;
end;
$$;

create trigger validate_property_purchase_before_write
before insert or update on public.properties
for each row
execute function public.validate_property_purchase();

create table public.chance_cards (
  id uuid primary key default gen_random_uuid(),
  card_key text not null unique,
  type text not null,
  title text not null,
  description text not null,
  amount integer null,
  steps integer null,
  target_tile_index integer null,
  created_at timestamptz not null default now(),

  constraint chance_cards_type_check
    check (type in ('receive_money', 'pay_money', 'move_to_start', 'move_steps', 'go_to_jail')),
  constraint chance_cards_card_key_format_check
    check (card_key ~ '^[a-z0-9_]+$'),
  constraint chance_cards_title_length_check
    check (char_length(trim(title)) between 1 and 80),
  constraint chance_cards_description_length_check
    check (char_length(trim(description)) between 1 and 200),
  constraint chance_cards_amount_check
    check (amount is null or amount > 0),
  constraint chance_cards_steps_check
    check (steps is null or steps between -12 and 12),
  constraint chance_cards_target_tile_index_check
    check (target_tile_index is null or target_tile_index between 0 and 23)
);

create index chance_cards_type_idx on public.chance_cards (type);

create table public.game_events (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms(id) on delete cascade,
  player_id uuid null references public.players(id) on delete set null,
  event_type text not null,
  message text not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),

  constraint game_events_event_type_length_check
    check (char_length(trim(event_type)) between 1 and 64),
  constraint game_events_message_length_check
    check (char_length(trim(message)) between 1 and 500),
  constraint game_events_payload_is_object_check
    check (jsonb_typeof(payload) = 'object')
);

create index game_events_room_id_created_at_idx
  on public.game_events (room_id, created_at desc);
create index game_events_room_id_event_type_idx
  on public.game_events (room_id, event_type);

create table public.game_snapshots (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms(id) on delete cascade,
  state jsonb not null,
  version integer not null default 1,
  created_at timestamptz not null default now(),

  constraint game_snapshots_version_check
    check (version > 0),
  constraint game_snapshots_state_is_object_check
    check (jsonb_typeof(state) = 'object')
);

create index game_snapshots_room_id_created_at_idx
  on public.game_snapshots (room_id, created_at desc);

create unique index game_snapshots_room_id_version_key
  on public.game_snapshots (room_id, version);
