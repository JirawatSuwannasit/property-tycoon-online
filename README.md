# Property Tycoon Online

Property Tycoon Online is an original multiplayer property trading board game concept with a cute pixel-art interface. The MVP is planned around a 24-tile board for 2-4 players, server-authoritative turns, and Supabase-powered realtime room sync in later phases.

This project intentionally avoids copying Monopoly branding, board layout, property names, card wording, token designs, artwork, or protected assets.

## Phase 1 status

This repository currently includes the Phase 1 application scaffold:

- Next.js App Router with TypeScript
- Tailwind CSS configuration
- Supabase browser/server helper files
- Placeholder homepage with create-room and join-room forms
- Placeholder `/room/[roomCode]` page
- Reusable pixel-style UI components

Database schema, room creation, realtime sync, and game rules are intentionally not implemented yet.

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
