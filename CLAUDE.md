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
│   ├── dashboard/               # Admin: tournament list
│   ├── tournaments/
│   │   ├── new/                 # Admin: create tournament
│   │   └── [id]/
│   │       ├── players/         # Admin: manage players (sees classifications)
│   │       ├── draw/            # Admin: generate draws
│   │       ├── rounds/[roundNum]/ # Admin: enter scores
│   │       ├── leaderboard/     # Admin: full leaderboard with classifications
│   │       └── live/            # PUBLIC: no auth required
│   │           ├── rounds/[roundNum]/ # Public: view matchups (no classifications)
│   │           └── leaderboard/      # Public: rankings (no classifications)
│   └── api/draw/                # API route for draw generation
├── components/
│   ├── ui/                      # Button, Input, Select, Badge
│   ├── layout/                  # Navbar
│   └── providers/               # SupabaseProvider (auth context)
├── lib/
│   ├── supabase/                # client.ts, server.ts, middleware.ts
│   ├── draw/                    # americano.ts (draw algorithm), types.ts
│   └── utils/                   # cn() helper
└── types/
    └── database.ts              # All TypeScript types
```

## Two-Sided Access
- **Admin** (auth required): Create tournaments, add players with classifications, generate draws, enter scores
- **Player/Public** (no auth): View matchups and rankings via `/tournaments/[id]/live` — classifications are hidden

## Game Rules
- **Format:** Americano doubles (2v2)
- **Points per match:** Always 5 (scores: 5-0, 4-1, 3-2)
- **Classifications:** A+, A, B+, B, C+, C
- **Draw constraint:** Same classification cannot pair as teammates
- **Tournament options:** 3/4/5 rounds, 8/16/32/64 players
- **Leaderboard:** Shows individual points per round + total, sorted by total

## Database
6 tables in Supabase: `profiles`, `tournaments`, `players`, `rounds`, `matches`, `match_players`
Migration file: `supabase/migrations/001_initial_schema.sql`

## Environment Variables
```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
```
