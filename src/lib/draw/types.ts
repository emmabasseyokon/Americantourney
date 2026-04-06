import type { Classification, Player } from "@/types/database";

export interface Team {
  player1: Player;
  player2: Player;
  strengthScore: number;
}

export interface MatchDraw {
  team1: Team;
  team2: Team;
  courtNumber: number;
}

/**
 * Relaxation level applied when hard rules can't all be satisfied
 * due to skewed classification distributions.
 */
export type RelaxationLevel = "none" | "same_class" | "close_class";

export interface RoundDraw {
  roundNumber: number;
  matches: MatchDraw[];
  /** Which relaxation level was needed for this round (if any). */
  relaxation: RelaxationLevel;
}

export const CLASSIFICATION_STRENGTH: Record<Classification, number> = {
  "A+": 6,
  A: 5,
  "B+": 4,
  B: 3,
  "C+": 2,
  C: 1,
};

export const HIGHER_TIERS: Classification[] = ["A+", "A", "B+"];
export const LOWER_TIERS: Classification[] = ["B", "C+", "C"];
