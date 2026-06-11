-- Enable Supabase Realtime for lobby synchronization only.
-- Clients subscribe to room/player changes and then refetch authoritative lobby state from API routes.

alter table public.rooms replica identity full;
alter table public.players replica identity full;

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
    and not exists (
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
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
    and not exists (
      select 1
      from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = 'players'
    ) then
    alter publication supabase_realtime add table public.players;
  end if;
end $$;
