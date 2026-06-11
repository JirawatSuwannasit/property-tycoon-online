# Property Tycoon Online

Property Tycoon Online is an original multiplayer property trading board game concept with a cute pixel-art interface. The MVP is planned around a 24-tile board for 2-4 players, server-authoritative turns, and Supabase-powered realtime room sync in later phases.

This project intentionally avoids copying Monopoly branding, board layout, property names, card wording, token designs, artwork, or protected assets.

## Project status

This repository currently includes the Phase 1 application scaffold and Phase 2 database foundation:

- Next.js App Router with TypeScript
- Tailwind CSS configuration
- Supabase browser/server helper files
- Placeholder homepage with create-room and join-room forms
- Placeholder `/room/[roomCode]` page
- Reusable pixel-style UI components
- Supabase SQL migrations for the MVP schema
- Seed data for exactly 24 original board tiles and 12 original chance cards
- TypeScript database and game schema types

Room creation, lobby logic, realtime sync, and game rules are intentionally not implemented yet.

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
```

Use `.env.local` for local development. Do not commit `.env.local`; it is ignored by git.

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
```

To apply these migrations with the Supabase CLI after linking your project:

```bash
supabase db push
```

Alternatively, you can open each SQL file and run it in order in the Supabase SQL Editor. Run the schema migration first, then the seed migration.

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

The `players.session_token_hash` column is nullable in Phase 2. Phase 3 will use it for player session validation when room APIs are implemented.

## Vercel deployment

1. Push the repository to GitHub.
2. Import the repository into Vercel.
3. Add the required environment variables in the Vercel project settings:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
4. Deploy with the default Next.js settings.

## Implementation plan

A standalone implementation plan is available at:

```text
docs/property-tycoon-online-plan.html
```
