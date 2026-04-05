@AGENTS.md

# Tourney — Americano Tournament Manager

## Tech Stack
- **Framework:** Next.js 16 (App Router) + React 19 + TypeScript
- **Styling:** Tailwind CSS 4
- **Backend:** Supabase (Auth, Postgres, Realtime)
- **Hosting:** Vercel
- **Icons:** Lucide React

## Commands
```bash
npm run dev       # Start dev server
npm run build     # Production build
npm run lint      # ESLint
```

## Project Structure
```
src/
├── app/                         # Next.js App Router pages
│   ├── auth/                    # Login, register, callback
│   ├── dashboard/               # Admin: tournament list with kebab menu (edit/delete)
│   ├── tournaments/
│   │   └── [id]/
│   │       ├── page.tsx         # Admin: single-page tabbed layout (Players/Matchups/Rankings)
│   │       └── live/
│   │           └── page.tsx     # PUBLIC: read-only tabbed layout (no auth, no classifications)
│   └── page.tsx                 # Landing page
├── components/
│   ├── ui/                      # Button, Input, Select, Skeleton
│   ├── layout/                  # Navbar (hidden on /live pages)
│   └── providers/               # SupabaseProvider (auth context)
├── lib/
│   ├── supabase/                # client.ts, server.ts, middleware.ts
│   ├── draw/                    # americano.ts (draw algorithm), types.ts
│   └── utils/                   # cn() helper
└── types/
    └── database.ts              # All TypeScript types
```

## Two-Sided Access
- **Admin** (auth required): Create tournaments, add players with classifications, generate/preview/lock draws, assign courts, record scores
- **Player/Public** (no auth): View matchups and rankings via `/tournaments/[id]/live` — classifications hidden, navbar hidden

## Game Rules
- **Format:** Americano doubles (2v2)
- **Points per match:** Always 5 (scores: 5-0, 4-1, 3-2)
- **Classifications:** A+, A, B+, B, C+, C
- **Draw constraints:**
  - Same classification cannot pair as teammates
  - A+ cannot pair with A
  - Two females cannot pair together
  - Females pair with higher-classified males for balance
- **Tournament options:** 3/4/5 rounds, 8/16/32/64 players
- **Leaderboard:** Individual points per round + total with position ordinal (e.g. "4 (1st)")

## Match Status Flow
- **Ready** → match generated, no court assigned
- **In Progress** → court assigned via "Start Match" (Court 1-7, Centre Court)
- **Completed** → scores recorded (team1 + team2 = 5)
- **Not Ready** → shown on future rounds when players are still playing current round
- Court badges (C1, C2, CC) shown next to player names on future round tabs

## Draw Generation
- Draws are generated client-side as a **preview** first
- Admin can **Regenerate** for new random pairings or **Lock** to save to DB
- Once locked, tournament edit (name/players/rounds) is disabled

## Database
6 tables in Supabase: `profiles`, `tournaments`, `players`, `rounds`, `matches`, `match_players`
Single migration file: `supabase/migrations/001_initial_schema.sql`

## Environment Variables
```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
```
