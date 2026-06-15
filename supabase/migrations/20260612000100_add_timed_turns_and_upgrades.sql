-- Phase 5/6 timed turns, landmark upgrades, and Thai travel property theme.
-- Browser countdowns are visual only; these persisted room fields are the server source of truth.

alter table public.rooms
  add column if not exists turn_phase text not null default 'waiting_to_roll',
  add column if not exists action_deadline_at timestamptz null,
  add column if not exists pending_tile_id uuid null references public.game_tiles(id) on delete set null,
  add column if not exists pending_action text null;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'rooms_turn_phase_check'
  ) then
    alter table public.rooms
      add constraint rooms_turn_phase_check
      check (turn_phase in (
        'waiting_to_roll',
        'resolving_roll',
        'waiting_to_buy_or_upgrade',
        'turn_ending',
        'finished'
      ));
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'rooms_pending_action_check'
  ) then
    alter table public.rooms
      add constraint rooms_pending_action_check
      check (pending_action is null or pending_action in ('buy_property', 'upgrade_property'));
  end if;
end $$;

alter table public.properties
  add column if not exists upgrade_level integer not null default 0;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'properties_upgrade_level_check'
  ) then
    alter table public.properties
      add constraint properties_upgrade_level_check
      check (upgrade_level between 0 and 3);
  end if;
end $$;

create index if not exists rooms_action_deadline_at_idx
  on public.rooms (action_deadline_at)
  where action_deadline_at is not null;

create index if not exists rooms_turn_phase_deadline_idx
  on public.rooms (turn_phase, action_deadline_at);

-- Allow browser realtime authorization to see non-sensitive room timing fields.
grant select (
  turn_phase,
  action_deadline_at,
  pending_tile_id,
  pending_action
) on table public.rooms to anon, authenticated;

-- Refresh property tile names to an original Thai landmark/travel theme.
-- These are route/landmark rights and visitor facility upgrades, not houses/hotels on landmarks.
update public.game_tiles
set name = case tile_index
    when 1 then 'Grand Palace Quarter'
    when 3 then 'Wat Arun Riverside'
    when 5 then 'Yaowarat Market'
    when 7 then 'Ayutthaya Heritage Park'
    when 9 then 'Sukhothai Old City'
    when 11 then 'Doi Suthep Viewpoint'
    when 13 then 'Chiang Mai Night Bazaar'
    when 15 then 'Phi Phi Island Pier'
    when 17 then 'Phuket Old Town'
    when 19 then 'Krabi Emerald Bay'
    when 21 then 'Samui Coconut Beach'
    when 23 then 'Phang Nga Bay'
    else name
  end,
  description = case tile_index
    when 1 then 'A visitor route near a grand cultural quarter. Buy landmark rights and upgrade visitor facilities.'
    when 3 then 'A riverside route glowing at sunset. Buy landmark rights and develop a respectful tourism zone.'
    when 5 then 'A colorful food and market route. Buy market route rights and upgrade visitor facilities.'
    when 7 then 'A heritage park route with ancient city charm. Buy heritage route rights and support visitor facilities.'
    when 9 then 'An old city heritage route with peaceful ruins and gardens. Buy heritage route rights and develop tourism services.'
    when 11 then 'A mountain viewpoint route above Chiang Mai. Buy viewpoint rights and upgrade visitor facilities.'
    when 13 then 'A lively northern bazaar route. Buy bazaar route rights and upgrade visitor facilities.'
    when 15 then 'An island pier route for bright day trips. Buy pier route rights and develop tourism services.'
    when 17 then 'A colorful old town walking route. Buy town route rights and upgrade visitor facilities.'
    when 19 then 'A limestone bay route with emerald water. Buy bay route rights and develop tourism services.'
    when 21 then 'A tropical beach route lined with coconut palms. Buy beach route rights and upgrade visitor facilities.'
    when 23 then 'A dramatic bay route with postcard views. Buy bay route rights and develop tourism services.'
    else description
  end
where type = 'property';
