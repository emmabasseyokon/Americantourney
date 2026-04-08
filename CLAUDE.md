@AGENTS.md

# Tourney — Americano Tournament Manager & Tennis Scoreboard

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
│   ├── scoreboards/
│   │   ├── page.tsx             # Admin: scoreboard list with create/delete
│   │   ├── [id]/
│   │   │   ├── page.tsx         # Admin: live scoring interface (tap to award points)
│   │   │   └── live/
│   │   │       └── page.tsx     # PUBLIC: real-time scoreboard (theme-aware, no auth)
│   │   └── live/
│   │       └── page.tsx         # PUBLIC: all in-progress matches list
│   ├── tournaments/
│   │   └── [id]/
│   │       ├── page.tsx         # Admin: single-page tabbed layout (Players/Matchups/Rankings)
│   │       └── live/
│   │           └── page.tsx     # PUBLIC: read-only tabbed layout (no auth, no classifications)
│   └── page.tsx                 # Landing page
├── components/
│   ├── ui/                      # Button, Input, Select, Skeleton, ThemeToggle
│   ├── layout/                  # Navbar (hidden on /live pages, logo → dashboard when logged in)
│   └── providers/               # SupabaseProvider, ThemeProvider
├── lib/
│   ├── supabase/                # client.ts, server.ts, middleware.ts
│   ├── draw/                    # americano.ts (draw algorithm), types.ts
│   ├── scoreboard/              # tennis.ts (scoring engine, types, display helpers)
│   └── utils/
│       ├── cn.ts                # Tailwind class merge helper
│       ├── format.ts            # Shared: ordinal(), getCourtLabel(), getStatusLabel(), getStatusColor()
│       ├── matchups.ts          # Shared: match enrichment, rankings, player status helpers
│       └── security.ts          # sanitizeString(), checkRateLimit()
└── types/
    └── database.ts              # All TypeScript types
```

## Two Features

### 1. Americano Tournaments
- **Admin** (auth required): Create tournaments, add players with classifications, generate/preview/lock draws, assign courts, record scores
- **Player/Public** (no auth): View matchups and rankings via `/tournaments/[id]/live` — classifications hidden, navbar hidden

### 2. Tennis Scoreboards
- **Admin** (auth required): Create matches (player names, best-of-3/5, optional court), score live via tap-to-award-point interface
- **Public** (no auth): Real-time scoreboard at `/scoreboards/[id]/live` (dark theme), all live matches at `/scoreboards/live`

## Tennis Scoreboard
- **Scoring format:** Standard tennis — 0/15/30/40/deuce/advantage, tiebreak at 6-6
- **Score state:** Stored as JSONB in `scoreboards` table, updated on each point
- **Scoring engine:** Pure function `awardPoint(state, player, bestOf)` in `src/lib/scoreboard/tennis.ts`
- **Undo:** History stack (last 50 states) for undo support
- **Auto-completion:** Match auto-completes when a player wins the required sets
- **Server tracking:** Alternates each game; tiebreak follows tennis serve rules
- **Admin UI:** Two large buttons (Point Player 1 / Point Player 2) + undo + share live link
- **Public UI:** Dark-themed scoreboard with real-time updates via Supabase Realtime
- **Live list:** `/scoreboards/live` shows all in-progress matches as cards, tap to open individual live view

## TV Mode
- **Purpose:** Fullscreen + scaled-up UI for TVs/projectors on live pages
- **Hook:** `useTvMode()` in `src/hooks/useTvMode.ts` — manages fullscreen API, `.tv-mode` class on `<html>`, auto-hides controls after 5s idle, sessionStorage persistence
- **Button:** `TvModeButton` component — floating button (Monitor/Minimize2 icons), auto-hides with controls in TV mode
- **CSS classes:** `.tv-mode` on `<html>` activates scaling; child markers: `tv-scoreboard`, `tv-match-card`, `tv-player-name`, `tv-score`, `tv-tabs`, `tv-round-tab`, `tv-badge`, `tv-table`, `tv-bottom-nav`
- **Pages:** Tournament live (`/tournaments/[id]/live`), Scoreboard live (`/scoreboards/[id]/live`), Scoreboards list live (`/scoreboards/live`)
- **ThemeToggle integration:** Accepts `tvAutoHide` + `controlsVisible` props to auto-hide alongside TV mode button

## Realtime
- Tournament live page subscribes to `postgres_changes` on `tournaments`, `players`, `rounds`, `matches` tables
- Scoreboard live pages subscribe to `postgres_changes` on `scoreboards` table
- Admin changes reflect instantly on public pages
- Supabase client stabilized with `useMemo(() => createClient(), [])` for persistent connections

## Shared Utilities (DRY)
- **`format.ts`**: `ordinal()`, `getCourtLabel()`, `getStatusLabel()`, `getStatusColor()` — used by both admin and live pages
- **`matchups.ts`**: Types (`MatchWithPlayers`, `RoundMatchupData`, `LeaderboardRow`), enrichment (`enrichMatchups`, `fetchAndEnrichMatchups`), rankings (`calculateRankings`, `fetchAndCalculateRankings`), status helpers (`buildPlayerActiveCourts`, `buildPlayerNotReady`, `isMatchNotReady`)

## Americano Game Rules
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

## Americano Match Status Flow
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

## Dark Mode
- **Toggle:** Sun/Moon icon in Navbar (admin pages) + floating ThemeToggle button on live pages
- **Implementation:** CSS custom properties in `globals.css` + Tailwind v4 `@custom-variant dark`
- **Persistence:** Saved to `localStorage` (`tourney-theme` key), restored on page load
- **Theme tokens:** `bg-surface`, `bg-surface-secondary`, `text-text-primary`, `text-text-secondary`, `border-border-theme`, etc.
- **Provider:** `ThemeProvider` wraps the app, adds/removes `.dark` class on `<html>`
- **All pages** (admin, live, auth, landing) respect the theme toggle

## Security
- **Rate limiting:** Client-side on login (5 attempts/min) and register (3 attempts/min) via `checkRateLimit()`
- **Input sanitization:** All user text inputs (player names, tournament names, display names) sanitized via `sanitizeString()` — strips HTML tags, dangerous characters (`<>"'&`), trims, enforces max length
- **Open redirect prevention:** `/auth/callback` validates `next` param is a safe relative path (starts with `/`, not `//`)
- **Security headers** (set in middleware): `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy: camera=(), microphone=(), geolocation=()`
- **RLS:** Every table has Row Level Security enabled with owner-based policies for write operations
- **SQL injection:** Not applicable — Supabase JS client uses parameterized queries; DB `CHECK` constraints validate enums and score ranges

## Database
7 tables in Supabase: `profiles`, `tournaments`, `players`, `rounds`, `matches`, `match_players`, `scoreboards`
Migration files: `supabase/migrations/001_initial_schema.sql`, `002_scoreboards.sql`

## Environment Variables
```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
```
