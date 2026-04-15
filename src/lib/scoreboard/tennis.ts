/**
 * Tennis & Padel scoring engine.
 *
 * Pure functions — takes a ScoreState, returns a new ScoreState.
 * Handles: points, deuce/advantage, golden point (no-ad), tiebreaks, set completion, match completion.
 */

export type PointScore = "0" | "15" | "30" | "40" | "AD";

export interface SetScore {
  p1: number;
  p2: number;
}

export interface ScoreState {
  sets: SetScore[];
  currentSet: SetScore;
  currentGame: { p1: PointScore; p2: PointScore };
  isTiebreak: boolean;
  isSuperTiebreak?: boolean;
  tiebreak: { p1: number; p2: number };
  server: 1 | 2;
  /** Set when the match ends. */
  matchWinner?: 1 | 2;
  /** History of states for undo. */
  history?: ScoreState[];
}

export type ScoreboardFormat = "standard" | "junior";

export interface Scoreboard {
  id: string;
  player1_name: string;
  player2_name: string;
  best_of: 3 | 5;
  format: ScoreboardFormat;
  sport_type: "tennis" | "padel";
  golden_point: boolean;
  score_state: ScoreState;
  status: "pending" | "in_progress" | "completed";
  winner: 1 | 2 | null;
  court_name: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

const NEXT_POINT: Record<PointScore, PointScore> = {
  "0": "15",
  "15": "30",
  "30": "40",
  "40": "40", // handled specially (game/deuce logic)
  AD: "AD",
};

/**
 * Create a fresh score state for a new match.
 */
export function createInitialState(): ScoreState {
  return {
    sets: [],
    currentSet: { p1: 0, p2: 0 },
    currentGame: { p1: "0", p2: "0" },
    isTiebreak: false,
    tiebreak: { p1: 0, p2: 0 },
    server: 1,
  };
}

/**
 * Award a point to a player and return the new state.
 * This is the main entry point — handles all tennis rules.
 */
export function awardPoint(
  state: ScoreState,
  player: 1 | 2,
  bestOf: 3 | 5,
  goldenPoint: boolean = false,
  format: ScoreboardFormat = "standard"
): ScoreState {
  // Don't allow scoring after match is over
  if (state.matchWinner) return state;

  // Save history for undo (strip nested history to avoid ballooning)
  const { history: _h, ...stateWithoutHistory } = state;
  const prev = JSON.parse(JSON.stringify(stateWithoutHistory)) as ScoreState;
  const historyStack = state.history ? [...state.history, prev] : [prev];

  let next: ScoreState;

  if (state.isSuperTiebreak) {
    next = awardSuperTiebreakPoint(state, player, bestOf);
  } else if (state.isTiebreak) {
    next = awardTiebreakPoint(state, player, bestOf, format);
  } else {
    next = awardGamePoint(state, player, bestOf, goldenPoint, format);
  }

  // Keep last 50 undo states
  next.history = historyStack.slice(-50);
  return next;
}

/**
 * Undo the last point. Returns previous state or current if no history.
 */
export function undoPoint(state: ScoreState): ScoreState {
  if (!state.history || state.history.length === 0) return state;
  const history = [...state.history];
  const prev = history.pop()!;
  prev.history = history;
  return prev;
}

// ── Internal helpers ──────────────────────────────────────────

function awardGamePoint(
  state: ScoreState,
  player: 1 | 2,
  bestOf: 3 | 5,
  goldenPoint: boolean = false,
  format: ScoreboardFormat = "standard"
): ScoreState {
  const s = deepClone(state);
  const scorer = player === 1 ? "p1" : "p2";
  const opponent = player === 1 ? "p2" : "p1";

  const scorerPts = s.currentGame[scorer];
  const opponentPts = s.currentGame[opponent];

  // Both at 40 — deuce logic
  if (scorerPts === "40" && opponentPts === "40") {
    // Golden point (no-ad): next point wins immediately
    if (goldenPoint) {
      return winGame(s, player, bestOf, format);
    }
    // Standard: scorer gets advantage
    s.currentGame[scorer] = "AD";
    return s;
  }

  // Scorer has advantage — wins the game
  if (scorerPts === "AD") {
    return winGame(s, player, bestOf, format);
  }

  // Opponent has advantage — back to deuce
  if (opponentPts === "AD") {
    s.currentGame.p1 = "40";
    s.currentGame.p2 = "40";
    return s;
  }

  // Scorer at 40, opponent not at 40 — wins the game
  if (scorerPts === "40") {
    return winGame(s, player, bestOf, format);
  }

  // Normal point progression
  s.currentGame[scorer] = NEXT_POINT[scorerPts];
  return s;
}

function awardTiebreakPoint(
  state: ScoreState,
  player: 1 | 2,
  bestOf: 3 | 5,
  format: ScoreboardFormat = "standard"
): ScoreState {
  const s = deepClone(state);
  const scorer = player === 1 ? "p1" : "p2";
  const opponent = player === 1 ? "p2" : "p1";

  s.tiebreak[scorer]++;

  const totalPoints = s.tiebreak.p1 + s.tiebreak.p2;

  // Switch server every 2 points (after first point, then every 2)
  if (totalPoints === 1 || (totalPoints > 1 && (totalPoints - 1) % 2 === 0)) {
    s.server = s.server === 1 ? 2 : 1;
  }

  // Check if tiebreak is won: at least 7 points and lead by 2
  if (s.tiebreak[scorer] >= 7 && s.tiebreak[scorer] - s.tiebreak[opponent] >= 2) {
    return winGame(s, player, bestOf, format);
  }

  return s;
}

/**
 * Super tiebreak (to 10, win by 2) — used as the final set in junior format.
 */
function awardSuperTiebreakPoint(
  state: ScoreState,
  player: 1 | 2,
  bestOf: 3 | 5
): ScoreState {
  const s = deepClone(state);
  const scorer = player === 1 ? "p1" : "p2";
  const opponent = player === 1 ? "p2" : "p1";

  s.tiebreak[scorer]++;

  const totalPoints = s.tiebreak.p1 + s.tiebreak.p2;

  // Switch server every 2 points (after first point, then every 2)
  if (totalPoints === 1 || (totalPoints > 1 && (totalPoints - 1) % 2 === 0)) {
    s.server = s.server === 1 ? 2 : 1;
  }

  // Check if super tiebreak is won: at least 10 points and lead by 2
  if (s.tiebreak[scorer] >= 10 && s.tiebreak[scorer] - s.tiebreak[opponent] >= 2) {
    // Super tiebreak counts as winning the final set
    s.sets.push({ ...s.tiebreak });
    s.isSuperTiebreak = false;
    s.tiebreak = { p1: 0, p2: 0 };
    s.matchWinner = player;
    return s;
  }

  return s;
}

function winGame(
  state: ScoreState,
  player: 1 | 2,
  bestOf: 3 | 5,
  format: ScoreboardFormat = "standard"
): ScoreState {
  const s = deepClone(state);
  const scorer = player === 1 ? "p1" : "p2";
  const opponent = player === 1 ? "p2" : "p1";

  const gamesForSet = format === "junior" ? 4 : 6;
  const tiebreakAt = format === "junior" ? 3 : 6;

  s.currentSet[scorer]++;

  // Reset game/tiebreak points
  s.currentGame = { p1: "0", p2: "0" };
  s.tiebreak = { p1: 0, p2: 0 };

  // Check if set is won
  const setWon = checkSetWon(s.currentSet, scorer, opponent, s.isTiebreak, gamesForSet);

  if (s.isTiebreak) {
    s.isTiebreak = false;
  }

  if (setWon) {
    return winSet(s, player, bestOf, format);
  }

  // Check if tiebreak should start (6-6 standard, 3-3 junior)
  if (s.currentSet.p1 === tiebreakAt && s.currentSet.p2 === tiebreakAt) {
    s.isTiebreak = true;
  }

  // Switch server (normal game)
  if (!s.isTiebreak) {
    s.server = s.server === 1 ? 2 : 1;
  }

  return s;
}

function checkSetWon(
  set: SetScore,
  scorer: "p1" | "p2",
  opponent: "p1" | "p2",
  wasTiebreak: boolean,
  gamesForSet: number = 6
): boolean {
  // Tiebreak win (7-6 standard, 4-3 junior)
  if (wasTiebreak) return true;

  // Normal set win: at least gamesForSet and lead by 2
  if (set[scorer] >= gamesForSet && set[scorer] - set[opponent] >= 2) return true;

  return false;
}

function winSet(
  state: ScoreState,
  player: 1 | 2,
  bestOf: 3 | 5,
  format: ScoreboardFormat = "standard"
): ScoreState {
  const s = deepClone(state);

  // Archive the completed set
  s.sets.push({ ...s.currentSet });
  s.currentSet = { p1: 0, p2: 0 };

  // Switch server for new set
  s.server = s.server === 1 ? 2 : 1;

  // Check if match is won
  const setsToWin = Math.ceil(bestOf / 2); // 2 for best-of-3, 3 for best-of-5
  const p1Sets = s.sets.filter((set) => set.p1 > set.p2).length;
  const p2Sets = s.sets.filter((set) => set.p2 > set.p1).length;

  if (player === 1 && p1Sets >= setsToWin) {
    s.matchWinner = 1;
  } else if (player === 2 && p2Sets >= setsToWin) {
    s.matchWinner = 2;
  }

  // Junior format: if entering final set (1-1), start super tiebreak instead
  if (!s.matchWinner && format === "junior" && s.sets.length === 2) {
    s.isSuperTiebreak = true;
    s.tiebreak = { p1: 0, p2: 0 };
  }

  return s;
}

function deepClone(state: ScoreState): ScoreState {
  const { history: _h, ...rest } = state;
  return JSON.parse(JSON.stringify(rest)) as ScoreState;
}

// ── Display helpers ──────────────────────────────────────────

/**
 * Format current game score for display.
 * In tiebreak: shows numeric points. Otherwise: standard tennis points.
 */
export function formatGameScore(state: ScoreState): { p1: string; p2: string } {
  if (state.isTiebreak || state.isSuperTiebreak) {
    return { p1: String(state.tiebreak.p1), p2: String(state.tiebreak.p2) };
  }
  return { p1: state.currentGame.p1, p2: state.currentGame.p2 };
}

/**
 * Get a summary string like "6-4, 3-6, 2-1" for completed + current set.
 */
export function formatMatchScore(state: ScoreState): string {
  const parts = state.sets.map((s) => `${s.p1}-${s.p2}`);
  if (!state.matchWinner) {
    parts.push(`${state.currentSet.p1}-${state.currentSet.p2}`);
  }
  return parts.join(", ");
}
