import type { Player } from "@/types/database";
import {
  CLASSIFICATION_STRENGTH,
  HIGHER_TIERS,
  LOWER_TIERS,
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
 * Split players into higher-tier and lower-tier pools.
 * If pools are uneven, moves boundary players to balance them.
 */
function splitPools(players: Player[]): { poolH: Player[]; poolL: Player[] } {
  const poolH = players.filter((p) =>
    HIGHER_TIERS.includes(p.classification)
  );
  const poolL = players.filter((p) =>
    LOWER_TIERS.includes(p.classification)
  );

  // Balance pools: move players from the larger pool to the smaller
  while (poolH.length > poolL.length + 1) {
    // Move weakest from H to L
    poolH.sort(
      (a, b) =>
        CLASSIFICATION_STRENGTH[a.classification] -
        CLASSIFICATION_STRENGTH[b.classification]
    );
    poolL.push(poolH.shift()!);
  }
  while (poolL.length > poolH.length + 1) {
    // Move strongest from L to H
    poolL.sort(
      (a, b) =>
        CLASSIFICATION_STRENGTH[b.classification] -
        CLASSIFICATION_STRENGTH[a.classification]
    );
    poolH.push(poolL.shift()!);
  }

  // If still off by one (odd total), move one more to even them out
  if (Math.abs(poolH.length - poolL.length) > 0) {
    if (poolH.length > poolL.length) {
      poolH.sort(
        (a, b) =>
          CLASSIFICATION_STRENGTH[a.classification] -
          CLASSIFICATION_STRENGTH[b.classification]
      );
      poolL.push(poolH.shift()!);
    } else {
      poolL.sort(
        (a, b) =>
          CLASSIFICATION_STRENGTH[b.classification] -
          CLASSIFICATION_STRENGTH[a.classification]
      );
      poolH.push(poolL.shift()!);
    }
  }

  return { poolH, poolL };
}

/**
 * Generate teams by pairing across pools, avoiding repeat partnerships.
 */
function generateTeams(
  poolH: Player[],
  poolL: Player[],
  usedPairs: Set<string>
): Team[] {
  const shuffledH = shuffle(poolH);
  const shuffledL = shuffle(poolL);
  const teams: Team[] = [];

  const usedL = new Set<number>();

  for (let i = 0; i < shuffledH.length; i++) {
    const hPlayer = shuffledH[i];
    let paired = false;

    // Try to find an L-pool partner not already used in a prior round
    for (let j = 0; j < shuffledL.length; j++) {
      if (usedL.has(j)) continue;
      const lPlayer = shuffledL[j];
      const key = pairKey(hPlayer.id, lPlayer.id);

      if (!usedPairs.has(key)) {
        teams.push({
          player1: hPlayer,
          player2: lPlayer,
          strengthScore:
            CLASSIFICATION_STRENGTH[hPlayer.classification] +
            CLASSIFICATION_STRENGTH[lPlayer.classification],
        });
        usedL.add(j);
        paired = true;
        break;
      }
    }

    // Fallback: pair with any available partner (repeat partnership if unavoidable)
    if (!paired) {
      for (let j = 0; j < shuffledL.length; j++) {
        if (!usedL.has(j)) {
          teams.push({
            player1: hPlayer,
            player2: shuffledL[j],
            strengthScore:
              CLASSIFICATION_STRENGTH[hPlayer.classification] +
              CLASSIFICATION_STRENGTH[shuffledL[j].classification],
          });
          usedL.add(j);
          break;
        }
      }
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

  const { poolH, poolL } = splitPools(players);
  const teams = generateTeams(poolH, poolL, pairingHistory);
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
