@AGENTS.md

# Tourney — Americano Tournament Manager

## Tech Stack
- **Framework:** Next.js 16 (App Router) + React 19 + TypeScript
- **Styling:** Tailwind CSS 4
- **Backend:** Supabase (Auth, Postgres, Realtime)
- **Hosting:** Vercel
- **Icons:** Lucide React
- **PWA:** Service worker + manifest with PNG icons (192x192, 512x512)

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
│   ├── layout/                  # Navbar (hidden on /live pages, logo → dashboard when logged in)
│   └── providers/               # SupabaseProvider (auth context)
├── lib/
│   ├── supabase/                # client.ts, server.ts, middleware.ts
│   ├── draw/                    # americano.ts (draw algorithm), types.ts
│   └── utils/
│       ├── cn.ts                # Tailwind class merge helper
│       ├── format.ts            # Shared: ordinal(), getCourtLabel(), getStatusLabel(), getStatusColor()
│       └── matchups.ts          # Shared: match enrichment, rankings, player status helpers
└── types/
    └── database.ts              # All TypeScript types
```

## Two-Sided Access
- **Admin** (auth required): Create tournaments, add players with classifications, generate/preview/lock draws, assign courts, record scores
- **Player/Public** (no auth): View matchups and rankings via `/tournaments/[id]/live` — classifications hidden, navbar hidden

## Realtime
- Public live page subscribes to Supabase Realtime (`postgres_changes`) on `tournaments`, `players`, `rounds`, `matches` tables
- Admin changes (start match, record scores, add players) reflect instantly on the public live page
- Supabase client stabilized with `useMemo(() => createClient(), [])` for persistent connections
- Realtime publication enabled in migration: `alter publication supabase_realtime add table ...`

## Shared Utilities (DRY)
- **`format.ts`**: `ordinal()`, `getCourtLabel()`, `getStatusLabel()`, `getStatusColor()` — used by both admin and live pages
- **`matchups.ts`**: Types (`MatchWithPlayers`, `RoundMatchupData`, `LeaderboardRow`), enrichment (`enrichMatchups`, `fetchAndEnrichMatchups`), rankings (`calculateRankings`, `fetchAndCalculateRankings`), status helpers (`buildPlayerActiveCourts`, `buildPlayerNotReady`, `isMatchNotReady`)

## Game Rules
- **Format:** Americano doubles (2v2)
- **Points per match:** Always 5 (scores: 5-0, 4-1, 3-2)
- **Classifications:** A+, A, B+, B, C+, C
- **Draw constraints (hard rules — progressively relaxed if classification diversity is insufficient):**
  - Two females cannot pair together (NEVER relaxed)
  - Same classification cannot pair as teammates (relaxed at level 1: `same_class`)
  - A+ cannot pair with A (relaxed at level 2: `close_class`)
  - A+ cannot pair with B+ (relaxed at level 2: `close_class`)
  - Females pair with higher-classified males for balance
- **No repeat pairings** across rounds (NEVER relaxed)
- **Progressive relaxation order:** all rules → allow same-class → allow close-class
- **Relaxation warning:** orange banner in preview listing affected rounds and which rules were relaxed
- **Tournament options:** 3/4/5 rounds, 8/16/32/64 players
- **Leaderboard:** Individual points per round + total with position ordinal (e.g. "4 (1st)")

## Match Status Flow
- **Ready** → match generated, no court assigned
- **In Progress** → court assigned via "Start Match" (Court 1-7, Centre Court)
- **Completed** → scores recorded (team1 + team2 = 5), court freed up
- **Not Ready** → shown on future rounds only when players are actively `in_progress` (not pending)
- Court badges (C1, C2, CC) shown next to player names on future round tabs
- Matchups sorted by status: in_progress → pending (ready) → completed
- Courts in use across ALL rounds are grayed out / unselectable when starting a match

## Draw Generation
- Draws are generated client-side as a **preview** first
- Preview shows player classifications next to names
- Repeat pairing alert shown in preview (red banner listing repeated pairs)
- Admin can **Regenerate** for new random pairings or **Lock** to save to DB
- Algorithm uses retry logic (50 attempts per relaxation level) with progressive rule relaxation
- Once locked, tournament edit (name/players/rounds) is disabled

## Database
6 tables in Supabase: `profiles`, `tournaments`, `players`, `rounds`, `matches`, `match_players`
Single migration file: `supabase/migrations/001_initial_schema.sql`

## Environment Variables
```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
```
