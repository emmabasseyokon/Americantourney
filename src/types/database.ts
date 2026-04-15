export type Classification = "A+" | "A" | "B+" | "B" | "C+" | "C";
export type Gender = "male" | "female";
export type TournamentStatus =
  | "draft"
  | "registration"
  | "in_progress"
  | "completed";
export type RoundStatus = "pending" | "in_progress" | "completed";
export type MatchStatus = "pending" | "in_progress" | "completed";

export interface Profile {
  id: string;
  email: string;
  display_name: string | null;
  avatar_url: string | null;
  logo_url: string | null;
  free_tournament_used: boolean;
  free_scoreboard_used: boolean;
  created_at: string;
}

export interface Tournament {
  id: string;
  name: string;
  total_rounds: 3 | 4 | 5;
  max_players: 8 | 16 | 32 | 64;
  status: TournamentStatus;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface Player {
  id: string;
  tournament_id: string;
  name: string;
  gender: Gender;
  classification: Classification;
  created_at: string;
}

export interface Round {
  id: string;
  tournament_id: string;
  round_number: number;
  status: RoundStatus;
  created_at: string;
}

export interface Match {
  id: string;
  round_id: string;
  court_number: number;
  court_name: string | null;
  team1_score: number;
  team2_score: number;
  status: MatchStatus;
  created_at: string;
}

export interface MatchPlayer {
  id: string;
  match_id: string;
  player_id: string;
  team: 1 | 2;
}

export type PaymentStatus = "pending" | "success" | "failed";
export type PaymentItemType = "tournament" | "scoreboard";

export interface Payment {
  id: string;
  user_id: string;
  item_type: PaymentItemType;
  amount_kobo: number;
  currency: "NGN";
  paystack_reference: string;
  paystack_access_code: string | null;
  status: PaymentStatus;
  item_metadata: Record<string, unknown>;
  created_item_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface LeaderboardEntry {
  id: string;
  tournament_id: string;
  player_id: string;
  round_points: Record<number, number>;
  total_points: number;
  player?: Player;
}
