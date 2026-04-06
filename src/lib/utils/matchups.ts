import type { Match, Player, Round } from "@/types/database";
import type { SupabaseClient } from "@supabase/supabase-js";

export type MatchWithPlayers = Match & {
  team1Players: Player[];
  team2Players: Player[];
};

export type RoundMatchupData = {
  round: Round;
  matches: MatchWithPlayers[];
};

export type LeaderboardRow = {
  player: Player;
  roundScores: Record<number, number>;
  total: number;
};

/**
 * Enrich matches with player data, grouped by round.
 */
export function enrichMatchups(
  rounds: Round[],
  matches: Match[],
  matchPlayers: { match_id: string; player_id: string; team: number }[],
  players: Player[]
): RoundMatchupData[] {
  const playerMap = new Map(players.map((p) => [p.id, p]));

  return rounds.map((round) => {
    const roundMatches = matches
      .filter((m) => m.round_id === round.id)
      .map((match) => {
        const mps = matchPlayers.filter((mp) => mp.match_id === match.id);
        return {
          ...match,
          team1Players: mps
            .filter((mp) => mp.team === 1)
            .map((mp) => playerMap.get(mp.player_id)!)
            .filter(Boolean),
          team2Players: mps
            .filter((mp) => mp.team === 2)
            .map((mp) => playerMap.get(mp.player_id)!)
            .filter(Boolean),
        };
      });
    // Sort: in_progress first, then pending (ready), then completed
    const statusOrder: Record<string, number> = {
      in_progress: 0,
      pending: 1,
      completed: 2,
    };
    roundMatches.sort(
      (a, b) => (statusOrder[a.status] ?? 1) - (statusOrder[b.status] ?? 1)
    );

    return { round, matches: roundMatches };
  });
}

/**
 * Fetch matches and match_players for given rounds, then enrich with player data.
 */
export async function fetchAndEnrichMatchups(
  supabase: SupabaseClient,
  rounds: Round[],
  players: Player[]
): Promise<RoundMatchupData[]> {
  if (rounds.length === 0) return [];

  const roundIds = rounds.map((r) => r.id);
  const { data: matches } = await supabase
    .from("matches")
    .select("*")
    .in("round_id", roundIds)
    .order("court_number");

  if (!matches || matches.length === 0) return [];

  const matchIds = matches.map((m) => m.id);
  const { data: matchPlayers } = await supabase
    .from("match_players")
    .select("*")
    .in("match_id", matchIds);

  return enrichMatchups(rounds, matches, matchPlayers ?? [], players);
}

/**
 * Calculate leaderboard rows from matches and players.
 */
export function calculateRankings(
  players: Player[],
  rounds: Round[],
  matches: Match[],
  matchPlayers: { match_id: string; player_id: string; team: number }[]
): LeaderboardRow[] {
  const matchRoundMap = new Map<string, number>();
  for (const match of matches) {
    const round = rounds.find((r) => r.id === match.round_id);
    if (round) matchRoundMap.set(match.id, round.round_number);
  }

  const playerScores = new Map<string, Record<number, number>>();
  for (const player of players) {
    playerScores.set(player.id, {});
  }

  for (const match of matches) {
    if (match.status !== "completed") continue;
    const roundNum = matchRoundMap.get(match.id);
    if (!roundNum) continue;
    const mps = matchPlayers.filter((mp) => mp.match_id === match.id);
    for (const mp of mps) {
      const score = mp.team === 1 ? match.team1_score : match.team2_score;
      const scores = playerScores.get(mp.player_id);
      if (scores) scores[roundNum] = score;
    }
  }

  const rows: LeaderboardRow[] = players.map((player) => {
    const roundScores = playerScores.get(player.id) ?? {};
    const total = Object.values(roundScores).reduce((s, v) => s + v, 0);
    return { player, roundScores, total };
  });

  rows.sort((a, b) => {
    if (b.total !== a.total) return b.total - a.total;
    const aMax = Math.max(0, ...Object.values(a.roundScores));
    const bMax = Math.max(0, ...Object.values(b.roundScores));
    if (bMax !== aMax) return bMax - aMax;
    return a.player.name.localeCompare(b.player.name);
  });

  return rows;
}

/**
 * Fetch matches data and calculate rankings.
 */
export async function fetchAndCalculateRankings(
  supabase: SupabaseClient,
  players: Player[],
  rounds: Round[]
): Promise<LeaderboardRow[]> {
  if (rounds.length === 0) {
    return players.map((p) => ({ player: p, roundScores: {}, total: 0 }));
  }

  const roundIds = rounds.map((r) => r.id);
  const { data: matches } = await supabase
    .from("matches")
    .select("*")
    .in("round_id", roundIds);
  const matchIds = (matches ?? []).map((m) => m.id);
  const { data: matchPlayers } = await supabase
    .from("match_players")
    .select("*")
    .in("match_id", matchIds);

  return calculateRankings(players, rounds, matches ?? [], matchPlayers ?? []);
}

/**
 * Build a map of player ID → court tag for players whose match is in_progress.
 * Only considers rounds before `activeRound`.
 */
export function buildPlayerActiveCourts(
  matchupData: RoundMatchupData[],
  activeRound: number
): Map<string, string> {
  const map = new Map<string, string>();
  for (const rd of matchupData) {
    if (rd.round.round_number >= activeRound) continue;
    for (const m of rd.matches) {
      if (m.status !== "in_progress" || m.court_number === 0) continue;
      const courtTag = m.court_number === 8 ? "CC" : `C${m.court_number}`;
      for (const p of [...m.team1Players, ...m.team2Players]) {
        map.set(p.id, courtTag);
      }
    }
  }
  return map;
}

/**
 * Build a set of player IDs whose previous-round match is in_progress.
 * Only considers rounds before `activeRound`.
 */
export function buildPlayerNotReady(
  matchupData: RoundMatchupData[],
  activeRound: number
): Set<string> {
  const set = new Set<string>();
  for (const rd of matchupData) {
    if (rd.round.round_number >= activeRound) continue;
    for (const m of rd.matches) {
      if (m.status !== "in_progress") continue;
      for (const p of [...m.team1Players, ...m.team2Players]) {
        set.add(p.id);
      }
    }
  }
  return set;
}

/**
 * Check if a match should show "Not Ready" status.
 */
export function isMatchNotReady(
  match: MatchWithPlayers,
  playerNotReady: Set<string>
): boolean {
  if (match.status !== "pending") return false;
  return [...match.team1Players, ...match.team2Players].some((p) =>
    playerNotReady.has(p.id)
  );
}
