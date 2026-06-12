# Property Tycoon Online

Property Tycoon Online is an original multiplayer property trading board game concept with a cute pixel-art interface. The MVP is planned around a 24-tile board for 2-4 players, server-authoritative turns, and Supabase-powered realtime room sync in later phases.

This project intentionally avoids copying Monopoly branding, board layout, property names, card wording, token designs, artwork, or protected assets.

## Project status

This repository currently includes the Phase 1 application scaffold, Phase 2 database foundation, and Phase 3 lobby flow:

- Next.js App Router with TypeScript
- Tailwind CSS configuration
- Supabase browser/server helper files
- Homepage with create-room and join-room forms
- Lobby page at `/room/[roomCode]`
- Reusable pixel-style UI components
- Supabase SQL migrations for the MVP schema
- Seed data for exactly 24 original board tiles and 12 original chance cards
- TypeScript database and game schema types
- Create room and join room API routes
- Browser-local player session tokens with database token hashes
- Lobby page with player list, host badge, ready status, and start-game validation

Realtime sync and game rules are intentionally not implemented yet.

## Local setup

Install dependencies:

```bash
npm install
```

Copy the environment example file:

```bash
cp .env.example .env.local
```

Fill in your Supabase project values in `.env.local`.

## Required environment variables

The app expects these variables:

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_publishable_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
```

Use `.env.local` for local development. Do not commit `.env.local`; it is ignored by git.

`SUPABASE_SERVICE_ROLE_KEY` is server-only and must never be exposed to browser code. Do not prefix it with `NEXT_PUBLIC_`. The room/lobby API routes use this key for server-authoritative writes while keeping validation in the API layer.


### Finding your Supabase service role key

In the Supabase dashboard, open your project and go to **Project Settings → API**. Copy the **service_role** key from the project API keys section into `.env.local` as `SUPABASE_SERVICE_ROLE_KEY`. Treat this key like a password: it bypasses Row Level Security and must only be used from server-side code.

## Run the development server

```bash
npm run dev
```

Then open [http://localhost:3000](http://localhost:3000) in your browser.


## Supabase migrations

Phase 2 adds the Supabase schema and seed data in:

```text
supabase/migrations/20260611000100_create_mvp_schema.sql
supabase/migrations/20260611000200_seed_mvp_board_and_cards.sql
supabase/migrations/20260611000300_enable_lobby_realtime.sql
supabase/migrations/20260611000400_fix_lobby_realtime_access.sql
supabase/migrations/20260612000100_add_timed_turns_and_upgrades.sql
supabase/migrations/20260612000200_add_turn_order_cards.sql
```

To apply these migrations with the Supabase CLI after linking your project:

```bash
supabase db push
```

Alternatively, you can open each SQL file and run it in order in the Supabase SQL Editor. Run the schema migration first, then the seed migration, both lobby realtime migrations, the timed-turn/upgrades migration, and finally the turn-order cards migration.

After applying the migrations, verify these tables in the Supabase Table Editor:

- `rooms`
- `players`
- `game_tiles`
- `properties`
- `chance_cards`
- `game_events`
- `game_snapshots`

Also verify that `game_tiles` contains exactly 24 original board tiles and `chance_cards` contains exactly 12 original chance cards.

### Security notes

Phase 2 does not add Row Level Security policies yet. Authorization and security rules will be handled in a later hardening phase before real gameplay is exposed.

Do not use Supabase service role keys in frontend code. The frontend should only use `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`.

The `players.session_token_hash` column is nullable in Phase 2 and is used by the room/lobby APIs for lightweight player session validation.


## Phase 3 lobby testing

After applying the Supabase migrations and setting `.env.local`, test the lobby flow manually:

1. Run the development server with `npm run dev`.
2. Open the homepage and create a room as the host with a display name.
3. Copy the 6-character room code from the lobby.
4. Open another browser or an incognito window and join with that room code and a second display name.
5. In the non-host browser, toggle Ready.
6. Confirm the host Start Game button stays disabled until there are 2-4 players and every non-host player is ready.
7. Click Start Game as the host and confirm the room status changes to `playing`.

Phase 3 uses a simple 5-second lobby polling/refetch strategy. Supabase Realtime subscriptions are planned for Phase 4.

Player sessions are intentionally lightweight for the MVP lobby: the raw session token is stored only in browser `localStorage`, while only `players.session_token_hash` is stored in the database.


## Phase 4 realtime lobby testing

Phase 4 subscribes the lobby page to Supabase Realtime changes for the current room's `rooms` and `players` rows. Realtime events are display/refetch triggers only: clients refetch lobby state from `/api/rooms/[roomCode]`, and all writes still go through validated API routes. The realtime access migration grants public read access only to non-sensitive lobby columns needed for change authorization; `session_token_hash`, money, position, and jail counters are not granted to browser roles.

To test realtime lobby sync with two browser windows:

1. Create a room as the host.
2. Join the room from another browser or an incognito window.
3. Confirm the host lobby updates automatically when the second player appears.
4. Toggle Ready as the second player.
5. Confirm the host Start Game button enables automatically.
6. Start the game as host.
7. Confirm the second player sees the room status change to `playing` automatically.

The lobby status indicator shows `Live` when Supabase Realtime returns `SUBSCRIBED`. If realtime is unavailable but the fallback refresh loop is active, it shows `Polling` instead of `Offline`. In local development, open the browser console and look for `[LobbyRealtime]` logs to inspect the channel name, room id filters, subscription status, and received realtime events. The lobby also keeps a manual Refresh button as an extra fallback.

## Phase 5 timed-turn plan

The updated Phase 5 implementation plan is available at:

```text
docs/phase-5-timed-turns-thai-landmarks-plan.html
```

Phase 5 will add server-authoritative 30-second roll and buy/upgrade deadlines, automatic server roll/skip handling, Thai landmark/travel-themed property names, and visitor-facility upgrade rules. The browser countdown will be visual only; the true deadline must be stored in Supabase.

## Phase 6 gameplay API routes

Phase 6 connects the server-authoritative game engine to API routes:

- `GET /api/game/[roomCode]/state` resolves expired deadlines, then returns room, players, board tiles, owned properties, recent events, winner data, and client-only action hints.
- `POST /api/game/[roomCode]/roll-dice` validates the player session/current turn and rolls dice on the server.
- `POST /api/game/[roomCode]/buy-property` buys pending landmark rights when the server says a buy decision is active.
- `POST /api/game/[roomCode]/upgrade-property` upgrades visitor facilities when the server says an upgrade decision is active.
- `POST /api/game/[roomCode]/sell-upgrade` sells one visitor-facility upgrade from an owned pending property for a server-calculated 50% refund of that upgrade level cost.
- `POST /api/game/[roomCode]/sell-property` sells unupgraded landmark rights for a server-calculated 50% refund of the tile price and removes the ownership row.
- `POST /api/game/[roomCode]/skip-decision` skips the current buy/upgrade/sell decision and advances the turn.
- `POST /api/game/[roomCode]/resolve-timeout` lets the client ask the server to resolve an expired deadline; the server decides whether anything expired.

Gameplay action routes require `playerId` and `sessionToken`. The raw token stays in browser `localStorage`; the database stores only `players.session_token_hash`.

Timed turns use the persisted `rooms.action_deadline_at` value. The browser countdown is visual only. When a state read/action/timeout check reaches the server, `resolveExpiredTurnAction(roomId)` auto-rolls expired roll phases or auto-skips expired buy/upgrade decisions.

## Phase 6.5 turn-order card draw

Phase 6.5 adds a server-authoritative turn-order draw when the host starts the game:

- Active players receive unique random cards from 1-4.
- The lowest card receives `play_order = 1` and becomes `rooms.current_turn_player_id`.
- Other players are ordered by ascending card number.
- The result is stored in `players.turn_order_card` and `players.play_order`, so refreshing the page never reshuffles a started game.
- The room page displays a Turn Order panel after the game starts, highlights the current player, and shows `Your turn` or `Waiting for <player name>`.

The client never shuffles or decides turn order. The host start API validates the lobby, draws cards server-side, stores the result, starts the first 30-second roll deadline, and writes game events for the draw and first player.

## Phase 6.7 gameplay action panel and sell actions

Phase 6.7 keeps host and non-host gameplay visibility identical after the game starts. If the current browser session belongs to `rooms.current_turn_player_id`, the action panel shows the same server-authorized roll, buy, upgrade, sell, and skip actions regardless of host status.

When a player lands on their own property, the server returns an own-property pending decision. The client displays server-calculated values only:

- `Sell Upgrade` is available when `upgrade_level > 0`; refund is `floor(current upgrade level cost * 0.5)`.
- `Sell Property` is available only when `upgrade_level = 0`; refund is `floor(tile.price * 0.5)`, and the ownership row is deleted.
- Properties with upgrades cannot be sold directly; sell upgrades first.
- All sale actions end the decision and advance to the next active player.


## Phase 7 board UI

Phase 7 adds the first full visual board for the game page:

- A responsive 24-tile perimeter board for the Thailand Landmark Trail.
- Tile cards show index, name, type, property price/rent, color group, owner marker, and upgrade level.
- Player tokens are CSS/text-based pixel tokens and multiple tokens can share the same tile.
- The current turn player's token and tile are highlighted, and pending decision tiles receive a separate highlight.
- The board consumes the existing server game state and never calculates dice, rent, money, ownership, or movement on the client.

## Verification notes

The project includes the required runtime and type packages in `package.json`: Next.js, React, React DOM, Supabase SSR/client libraries, TypeScript, Node types, and React types.

Run these checks after installing dependencies with `npm install`:

```bash
npm run typecheck
npm run build
```

If dependencies have not been installed yet, `npm run typecheck` and `npm run build` will fail with missing module/type errors for packages such as `next`, `react`, and `@supabase/ssr`.

## Production room-loading troubleshooting

If creating a room redirects to `/room/[code]` but the room page cannot load in Vercel:

1. Confirm all Supabase migrations listed above have been applied, including both lobby realtime migrations. The create-room route now writes the room, host player, initial `game_snapshots` row, and `game_events` audit row, so the Phase 2 tables must exist before testing in production.
2. Confirm Vercel has these environment variables for the deployed environment: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and server-only `SUPABASE_SERVICE_ROLE_KEY`.
3. Check Vercel Function logs for JSON error messages from `/api/rooms/create` or `/api/rooms/[roomCode]`. API routes log unexpected Supabase/runtime errors and return JSON errors to the browser.
4. If realtime env/public config is missing, the lobby should still render with a readable realtime warning and the manual Refresh button instead of crashing the page.

## Vercel deployment

1. Push the repository to GitHub.
2. Import the repository into Vercel.
3. Add the required environment variables in the Vercel project settings:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
4. Deploy with the default Next.js settings.

If create/join room requests fail in Vercel, first confirm all three environment variables above are configured for the deployed environment. The room API routes always return JSON success/error payloads, so the browser should show a readable API error instead of an empty-response JSON parse failure.

## Implementation plan

A standalone implementation plan is available at:

```text
docs/property-tycoon-online-plan.html
```
