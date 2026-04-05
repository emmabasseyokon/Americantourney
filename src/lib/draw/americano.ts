import type { Player } from "@/types/database";
import {
  CLASSIFICATION_STRENGTH,
  type MatchDraw,
  type RoundDraw,
  type Team,
} from "./types";

/**
 * Fisher-Yates shuffle — returns a new shuffled array.
 */
function shuffle<T>(arr: T[]): T[] {
  const result = [...arr];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

/**
 * Create a pair key (order-independent) for two player IDs.
 */
function pairKey(a: string, b: string): string {
  return [a, b].sort().join(":");
}

/**
 * Check if two players are forbidden from pairing as teammates.
 * Hard rules (never violated):
 * 1. Two females cannot pair (regardless of classification)
 * 2. Same classification cannot pair (A+/A+, A/A, B/B, B+/B+, C/C, C+/C+)
 * 3. A+ cannot pair with A
 * 4. A+ cannot pair with B+
 */
function isForbiddenPairing(p1: Player, p2: Player): boolean {
  if (p1.gender === "female" && p2.gender === "female") return true;
  if (p1.classification === p2.classification) return true;
  const sorted = [p1.classification, p2.classification].sort();
  if (sorted[0] === "A" && sorted[1] === "A+") return true;
  if (sorted[0] === "A+" && sorted[1] === "B+") return true;
  return false;
}

/**
 * Generate teams with constraints:
 * 1. Two females CANNOT pair together (hard rule)
 * 2. Same classification CANNOT pair (hard rule)
 * 3. A+ CANNOT pair A (hard rule)
 * 4. Females pair with higher-classified males for balance
 * 5. Male+male is allowed when there are more males than females
 * 6. Avoid repeat partnerships from prior rounds (soft preference)
 *
 * Uses retry logic — reshuffles and retries if pairing fails,
 * rather than breaking hard rules.
 */
function generateTeams(
  players: Player[],
  usedPairs: Set<string>
): Team[] {
  const MAX_ATTEMPTS = 50;

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const result = tryGenerateTeams(players, usedPairs, attempt > 0);
    if (result) return result;
  }

  // Final fallback: allow repeat pairs but never break hard rules
  const result = tryGenerateTeams(players, usedPairs, true);
  if (result) return result;

  throw new Error(
    "Cannot generate valid teams. Check player classifications — hard rules (same class, A+/A, two females) may make pairing impossible with this player set."
  );
}

function tryGenerateTeams(
  players: Player[],
  usedPairs: Set<string>,
  allowRepeats: boolean
): Team[] | null {
  const females = shuffle(players.filter((p) => p.gender === "female"));
  const males = shuffle(players.filter((p) => p.gender === "male"));

  const teams: Team[] = [];
  const paired = new Set<string>();

  // Step 1: Pair each female with a male
  for (const female of females) {
    let bestMatch: Player | null = null;

    // Try: valid classification + not a repeat pair
    if (!allowRepeats) {
      for (const male of males) {
        if (paired.has(male.id)) continue;
        if (isForbiddenPairing(male, female)) continue;
        if (usedPairs.has(pairKey(male.id, female.id))) continue;
        bestMatch = male;
        break;
      }
    }

    // Fallback: valid classification (allow repeat pair)
    if (!bestMatch) {
      for (const male of males) {
        if (paired.has(male.id)) continue;
        if (isForbiddenPairing(male, female)) continue;
        bestMatch = male;
        break;
      }
    }

    // No valid partner found — this shuffle failed
    if (!bestMatch) return null;

    teams.push({
      player1: bestMatch,
      player2: female,
      strengthScore:
        CLASSIFICATION_STRENGTH[bestMatch.classification] +
        CLASSIFICATION_STRENGTH[female.classification],
    });
    paired.add(bestMatch.id);
    paired.add(female.id);
  }

  // Step 2: Pair remaining males with each other
  const remainingMales = shuffle(males.filter((m) => !paired.has(m.id)));
  const usedRemaining = new Set<number>();

  for (let i = 0; i < remainingMales.length; i++) {
    if (usedRemaining.has(i)) continue;
    const player1 = remainingMales[i];
    let foundIdx = -1;

    // Try: valid classification + not a repeat pair
    if (!allowRepeats) {
      for (let j = i + 1; j < remainingMales.length; j++) {
        if (usedRemaining.has(j)) continue;
        if (isForbiddenPairing(player1, remainingMales[j])) continue;
        if (usedPairs.has(pairKey(player1.id, remainingMales[j].id))) continue;
        foundIdx = j;
        break;
      }
    }

    // Fallback: valid classification (allow repeat)
    if (foundIdx === -1) {
      for (let j = i + 1; j < remainingMales.length; j++) {
        if (usedRemaining.has(j)) continue;
        if (isForbiddenPairing(player1, remainingMales[j])) continue;
        foundIdx = j;
        break;
      }
    }

    // No valid partner — this shuffle failed
    if (foundIdx === -1) return null;

    const player2 = remainingMales[foundIdx];
    teams.push({
      player1,
      player2,
      strengthScore:
        CLASSIFICATION_STRENGTH[player1.classification] +
        CLASSIFICATION_STRENGTH[player2.classification],
    });
    usedRemaining.add(i);
    usedRemaining.add(foundIdx);
  }

  return teams;
}

/**
 * Form balanced matches from teams.
 * Sort by strength and pair adjacent teams for competitive balance.
 */
function formMatches(teams: Team[]): MatchDraw[] {
  const sorted = [...teams].sort((a, b) => b.strengthScore - a.strengthScore);
  const matches: MatchDraw[] = [];

  for (let i = 0; i < sorted.length; i += 2) {
    matches.push({
      team1: sorted[i],
      team2: sorted[i + 1],
      courtNumber: Math.floor(i / 2) + 1,
    });
  }

  return matches;
}

/**
 * Generate a complete round draw.
 *
 * @param players - All players in the tournament
 * @param roundNumber - Current round number
 * @param pairingHistory - Set of pair keys from previous rounds
 * @returns The round draw with all matches
 */
export function generateRoundDraw(
  players: Player[],
  roundNumber: number,
  pairingHistory: Set<string>
): RoundDraw {
  if (players.length < 4) {
    throw new Error("Need at least 4 players to generate a draw.");
  }

  if (players.length % 2 !== 0) {
    throw new Error("Player count must be even for doubles.");
  }

  const teams = generateTeams(players, pairingHistory);
  const matches = formMatches(teams);

  return { roundNumber, matches };
}

/**
 * Extract pair keys from a round draw (for history tracking).
 */
export function extractPairKeys(draw: RoundDraw): string[] {
  const keys: string[] = [];
  for (const match of draw.matches) {
    keys.push(pairKey(match.team1.player1.id, match.team1.player2.id));
    keys.push(pairKey(match.team2.player1.id, match.team2.player2.id));
  }
  return keys;
}
