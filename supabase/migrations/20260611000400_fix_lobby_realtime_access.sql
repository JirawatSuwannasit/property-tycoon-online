-- Repair lobby realtime access for browser clients that use the public anon key.
-- Realtime remains display/refetch only: clients receive change signals and then call API routes.
-- Keep sensitive player columns (session_token_hash, money, position, jail_turns) out of anon SELECT grants.

alter table public.rooms replica identity full;
alter table public.players replica identity full;

alter table public.rooms enable row level security;
alter table public.players enable row level security;

revoke all on table public.rooms from anon, authenticated;
revoke all on table public.players from anon, authenticated;

grant select (
  id,
  room_code,
  status,
  max_players,
  host_player_id,
  current_turn_player_id,
  winner_player_id,
  turn_number,
  created_at,
  updated_at
) on table public.rooms to anon, authenticated;

grant select (
  id,
  room_id,
  display_name,
  avatar_key,
  seat_no,
  is_host,
  is_ready,
  status,
  created_at,
  updated_at
) on table public.players to anon, authenticated;

drop policy if exists "Lobby rooms are observable for realtime" on public.rooms;
create policy "Lobby rooms are observable for realtime"
  on public.rooms
  for select
  to anon, authenticated
  using (true);

drop policy if exists "Lobby players are observable for realtime" on public.players;
create policy "Lobby players are observable for realtime"
  on public.players
  for select
  to anon, authenticated
  using (true);

do $$
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    create publication supabase_realtime;
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'rooms'
  ) then
    alter publication supabase_realtime add table public.rooms;
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'players'
  ) then
    alter publication supabase_realtime add table public.players;
  end if;
end $$;
