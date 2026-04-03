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

export interface RoundDraw {
  roundNumber: number;
  matches: MatchDraw[];
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
