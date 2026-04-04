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
 * Check if two classifications are forbidden from pairing as teammates.
 * Rules: same classification cannot pair, and A+ cannot pair with A.
 */
function isForbiddenPairing(c1: string, c2: string): boolean {
  if (c1 === c2) return true;
  const sorted = [c1, c2].sort();
  if (sorted[0] === "A" && sorted[1] === "A+") return true;
  return false;
}

/**
 * Generate teams with constraints:
 * 1. Two females CANNOT pair together
 * 2. Same classification should not pair (relaxed if unavoidable)
 * 3. Females pair with higher-classified males for balance
 * 4. Male+male is allowed when there are more males than females
 * 5. Avoid repeat partnerships from prior rounds
 */
function generateTeams(
  players: Player[],
  usedPairs: Set<string>
): Team[] {
  const females = shuffle(players.filter((p) => p.gender === "female"));
  const males = shuffle(
    players.filter((p) => p.gender === "male")
  ).sort(
    // Sort males by classification descending so higher-class males are paired first with females
    (a, b) =>
      CLASSIFICATION_STRENGTH[b.classification] -
      CLASSIFICATION_STRENGTH[a.classification]
  );

  const teams: Team[] = [];
  const paired = new Set<string>(); // track paired player IDs

  // Step 1: Pair each female with a male (different classification, no repeat)
  for (const female of females) {
    let bestMatch: Player | null = null;

    // Priority 1: different classification + not a repeat pair
    for (const male of males) {
      if (paired.has(male.id)) continue;
      if (isForbiddenPairing(male.classification, female.classification)) continue;
      if (usedPairs.has(pairKey(male.id, female.id))) continue;
      bestMatch = male;
      break;
    }

    // Priority 2: different classification (allow repeat pair)
    if (!bestMatch) {
      for (const male of males) {
        if (paired.has(male.id)) continue;
        if (isForbiddenPairing(male.classification, female.classification)) continue;
        bestMatch = male;
        break;
      }
    }

    // Priority 3: any available male (same classification if unavoidable)
    if (!bestMatch) {
      for (const male of males) {
        if (paired.has(male.id)) continue;
        bestMatch = male;
        break;
      }
    }

    if (bestMatch) {
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
  }

  // Step 2: Pair remaining males with each other (different classification, no repeat)
  const remainingMales = shuffle(
    males.filter((m) => !paired.has(m.id))
  );

  const usedRemaining = new Set<number>();

  for (let i = 0; i < remainingMales.length; i++) {
    if (usedRemaining.has(i)) continue;
    const player1 = remainingMales[i];
    let foundIdx = -1;

    // Priority 1: different classification + not a repeat pair
    for (let j = i + 1; j < remainingMales.length; j++) {
      if (usedRemaining.has(j)) continue;
      const player2 = remainingMales[j];
      if (isForbiddenPairing(player2.classification, player1.classification)) continue;
      if (usedPairs.has(pairKey(player1.id, player2.id))) continue;
      foundIdx = j;
      break;
    }

    // Priority 2: different classification (allow repeat)
    if (foundIdx === -1) {
      for (let j = i + 1; j < remainingMales.length; j++) {
        if (usedRemaining.has(j)) continue;
        if (isForbiddenPairing(remainingMales[j].classification, player1.classification)) continue;
        foundIdx = j;
        break;
      }
    }

    // Priority 3: any available male
    if (foundIdx === -1) {
      for (let j = i + 1; j < remainingMales.length; j++) {
        if (!usedRemaining.has(j)) {
          foundIdx = j;
          break;
        }
      }
    }

    if (foundIdx !== -1) {
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
