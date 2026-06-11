-- Original MVP board and chance card seed data for Property Tycoon Online.
-- The MVP board contains exactly 24 tiles and uses original cozy pixel-world
-- names and descriptions. It intentionally avoids Monopoly names, card text,
-- board layout, artwork, branding, and token designs.

insert into public.game_tiles (
  tile_index,
  type,
  name,
  description,
  price,
  rent,
  amount,
  color_group
)
values
  (0, 'start', 'Pixel Plaza', 'Begin the cozy route and collect a plaza bonus when future rules allow it.', null, null, 200, null),
  (1, 'property', 'Mochi Market', 'A tiny stall district with warm rice cakes and cheerful signs.', 90, 18, null, 'mint'),
  (2, 'chance', 'Lucky Lantern', 'Draw a bright surprise from the lantern basket.', null, null, null, null),
  (3, 'property', 'Cloud Bakery', 'A fluffy bakery floating with sugar-dusted pixel pastries.', 100, 20, null, 'mint'),
  (4, 'tax', 'Snack Tax', 'Pay a small snack stand fee to keep the festival tidy.', null, null, -80, null),
  (5, 'property', 'Bamboo Arcade', 'A bamboo-framed arcade packed with blinking cabinet lights.', 120, 24, null, 'sky'),
  (6, 'bonus', 'Cozy Bonus', 'A neighbor shares a small gift for your journey.', null, null, 100, null),
  (7, 'property', 'Pixel Pier', 'A breezy pier with bobbing boats and tiny souvenir flags.', 130, 26, null, 'sky'),
  (8, 'jail', 'Nap Nook', 'A quiet corner for resting when the route gets too stormy.', null, null, null, null),
  (9, 'property', 'Lantern Lane', 'A glowing lane lined with handmade lanterns and soft music.', 150, 30, null, 'coral'),
  (10, 'chance', 'Moon Mail', 'Open a moonlit envelope with an unexpected errand.', null, null, null, null),
  (11, 'property', 'Sunny Studio', 'A bright creator studio full of paint pots and pixel sketches.', 160, 32, null, 'coral'),
  (12, 'bonus', 'Festival Gift', 'A festival booth hands you a cheerful prize pouch.', null, null, 120, null),
  (13, 'property', 'Pudding Park', 'A pudding-shaped park where families picnic under cube trees.', 180, 36, null, 'lavender'),
  (14, 'tax', 'Repair Fee', 'Patch up a few cracked stepping stones after the parade.', null, null, -120, null),
  (15, 'property', 'Starry Station', 'A little transit stop sparkling with star-shaped lamps.', 190, 38, null, 'lavender'),
  (16, 'chance', 'Sprinkle Surprise', 'Pick a card dusted with colorful candy sprinkles.', null, null, null, null),
  (17, 'property', 'Clover Court', 'A lucky courtyard dotted with green tiles and clover planters.', 210, 42, null, 'leaf'),
  (18, 'go_to_jail', 'Storm Shortcut', 'A windy shortcut sends travelers straight to the Nap Nook.', null, null, null, null),
  (19, 'property', 'Tiny Treetop', 'A miniature treetop village connected by ribbon bridges.', 220, 44, null, 'leaf'),
  (20, 'bonus', 'Picnic Prize', 'Find a picnic basket with a friendly coin reward.', null, null, 140, null),
  (21, 'property', 'Aurora Alley', 'A shimmering alley painted with soft northern-light colors.', 240, 48, null, 'gold'),
  (22, 'bonus', 'Gem Jar', 'A sparkling jar of gems appears beside the path.', null, null, 160, null),
  (23, 'property', 'Dreamy Docks', 'A dreamy dockside neighborhood with pastel sails and sleepy waves.', 260, 52, null, 'gold')
on conflict (tile_index) do update
set
  type = excluded.type,
  name = excluded.name,
  description = excluded.description,
  price = excluded.price,
  rent = excluded.rent,
  amount = excluded.amount,
  color_group = excluded.color_group;

insert into public.chance_cards (
  card_key,
  type,
  title,
  description,
  amount,
  steps,
  target_tile_index
)
values
  ('berry_bonus', 'receive_money', 'Berry Bonus', 'A berry basket sells out at the morning market. Collect 80 coins.', 80, null, null),
  ('arcade_jackpot', 'receive_money', 'Arcade Jackpot', 'Your tiny arcade cabinet pays a cheerful prize. Collect 120 coins.', 120, null, null),
  ('lost_wallet_returned', 'receive_money', 'Wallet Returned', 'A neighbor returns your coin pouch with a thank-you note. Collect 60 coins.', 60, null, null),
  ('snack_spill', 'pay_money', 'Snack Spill', 'A fizzy drink splashes over your booth sign. Pay 50 coins.', 50, null, null),
  ('lantern_repair', 'pay_money', 'Lantern Repair', 'Wind rattles your paper lanterns. Pay 90 coins for repairs.', 90, null, null),
  ('festival_fee', 'pay_money', 'Festival Fee', 'The town festival needs a shared booth fee. Pay 70 coins.', 70, null, null),
  ('parade_to_plaza', 'move_to_start', 'Parade to Plaza', 'Join the pixel parade back to Pixel Plaza.', null, null, 0),
  ('tailwind_scoot', 'move_steps', 'Tailwind Scoot', 'A gentle breeze nudges you forward 3 tiles.', null, 3, null),
  ('puddle_detour', 'move_steps', 'Puddle Detour', 'Hop around a shiny puddle and move back 2 tiles.', null, -2, null),
  ('shortcut_map', 'move_steps', 'Shortcut Map', 'A hand-drawn map sends you forward 5 tiles.', null, 5, null),
  ('sleepy_guard', 'go_to_jail', 'Sleepy Guard', 'A sleepy guard points you to the Nap Nook.', null, null, 8),
  ('moonlit_stroll', 'move_steps', 'Moonlit Stroll', 'Take a calm moonlit stroll forward 1 tile.', null, 1, null)
on conflict (card_key) do update
set
  type = excluded.type,
  title = excluded.title,
  description = excluded.description,
  amount = excluded.amount,
  steps = excluded.steps,
  target_tile_index = excluded.target_tile_index;

do $$
begin
  if (select count(*) from public.game_tiles) <> 24 then
    raise exception 'Expected exactly 24 game tiles after seed migration';
  end if;

  if (select count(*) from public.chance_cards) <> 12 then
    raise exception 'Expected exactly 12 chance cards after seed migration';
  end if;
end;
$$;
