"use client";

import { createClient } from "@/lib/supabase/client";
import type { Player, Match } from "@/types/database";
import { ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";

interface MatchWithPlayers extends Match {
  team1Players: Player[];
  team2Players: Player[];
}

export default function LiveRoundPage() {
  const supabase = createClient();
  const params = useParams();
  const tournamentId = params.id as string;
  const roundNum = parseInt(params.roundNum as string);

  const [matches, setMatches] = useState<MatchWithPlayers[]>([]);
  const [totalRounds, setTotalRounds] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      const { data: tournament } = await supabase
        .from("tournaments")
        .select("total_rounds")
        .eq("id", tournamentId)
        .single();

      setTotalRounds(tournament?.total_rounds ?? 0);

      const { data: round } = await supabase
        .from("rounds")
        .select("*")
        .eq("tournament_id", tournamentId)
        .eq("round_number", roundNum)
        .single();

      if (!round) {
        setLoading(false);
        return;
      }

      const { data: matchesData } = await supabase
        .from("matches")
        .select("*")
        .eq("round_id", round.id)
        .order("court_number");

      const matchIds = (matchesData ?? []).map((m) => m.id);
      const { data: matchPlayers } = await supabase
        .from("match_players")
        .select("*")
        .in("match_id", matchIds);

      const { data: players } = await supabase
        .from("players")
        .select("*")
        .eq("tournament_id", tournamentId);

      const playerMap = new Map((players ?? []).map((p) => [p.id, p]));

      const enriched: MatchWithPlayers[] = (matchesData ?? []).map((match) => {
        const mps = (matchPlayers ?? []).filter(
          (mp) => mp.match_id === match.id
        );
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

      setMatches(enriched);
      setLoading(false);
    }

    fetchData();
  }, [roundNum]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-gray-500">Loading...</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <h1 className="text-center text-2xl font-bold text-gray-900">
        Round {roundNum} of {totalRounds}
      </h1>

      <div className="mt-6 space-y-4">
        {matches.map((match) => (
          <div
            key={match.id}
            className="rounded-lg border border-gray-200 bg-white p-4"
          >
            <span className="text-xs font-medium text-gray-500">
              Court {match.court_number}
            </span>

            <div className="mt-2 flex items-center justify-between">
              {/* Team 1 - names only, no classification */}
              <div className="flex-1">
                {match.team1Players.map((p) => (
                  <p key={p.id} className="text-sm font-medium text-gray-900">
                    {p.name}
                  </p>
                ))}
              </div>

              {/* Score */}
              <div className="px-4 text-center">
                {match.status === "completed" ? (
                  <span className="text-xl font-bold text-gray-900">
                    {match.team1_score} - {match.team2_score}
                  </span>
                ) : (
                  <span className="text-sm text-gray-400">vs</span>
                )}
              </div>

              {/* Team 2 - names only */}
              <div className="flex-1 text-right">
                {match.team2Players.map((p) => (
                  <p key={p.id} className="text-sm font-medium text-gray-900">
                    {p.name}
                  </p>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Navigation */}
      <div className="mt-6 flex justify-between">
        {roundNum > 1 ? (
          <Link
            href={`/tournaments/${tournamentId}/live/rounds/${roundNum - 1}`}
            className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700"
          >
            <ChevronLeft className="h-4 w-4" /> Round {roundNum - 1}
          </Link>
        ) : (
          <div />
        )}
        {roundNum < totalRounds ? (
          <Link
            href={`/tournaments/${tournamentId}/live/rounds/${roundNum + 1}`}
            className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700"
          >
            Round {roundNum + 1} <ChevronRight className="h-4 w-4" />
          </Link>
        ) : (
          <div />
        )}
      </div>
    </div>
  );
}
