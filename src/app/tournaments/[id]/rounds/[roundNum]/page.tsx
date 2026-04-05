"use client";

import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { useSupabase } from "@/components/providers/SupabaseProvider";
import { SkeletonCards } from "@/components/ui/Skeleton";
import type { Player, Match } from "@/types/database";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";

interface MatchWithPlayers extends Match {
  team1Players: Player[];
  team2Players: Player[];
}

export default function RoundPage() {
  const { supabase } = useSupabase();
  const params = useParams();
  const tournamentId = params.id as string;
  const roundNum = parseInt(params.roundNum as string);

  const [matches, setMatches] = useState<MatchWithPlayers[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [scores, setScores] = useState<Record<string, number>>({});

  useEffect(() => {
    async function fetchRoundData() {
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

      if (!matchesData) {
        setLoading(false);
        return;
      }

      const matchIds = matchesData.map((m) => m.id);
      const { data: matchPlayers } = await supabase
        .from("match_players")
        .select("*")
        .in("match_id", matchIds);

      const { data: players } = await supabase
        .from("players")
        .select("*")
        .eq("tournament_id", tournamentId);

      const playerMap = new Map((players ?? []).map((p) => [p.id, p]));

      const enriched: MatchWithPlayers[] = matchesData.map((match) => {
        const mps = (matchPlayers ?? []).filter((mp) => mp.match_id === match.id);
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

      const scoreMap: Record<string, number> = {};
      for (const m of enriched) {
        scoreMap[m.id] = m.team1_score;
      }
      setScores(scoreMap);
      setLoading(false);
    }
    fetchRoundData();
  }, [supabase, tournamentId, roundNum]);

  async function handleSaveScore(matchId: string) {
    const team1Score = scores[matchId] ?? 0;
    const team2Score = 5 - team1Score;

    setSaving(matchId);
    await supabase
      .from("matches")
      .update({
        team1_score: team1Score,
        team2_score: team2Score,
        status: "completed",
      })
      .eq("id", matchId);

    // Update local state
    setMatches((prev) =>
      prev.map((m) =>
        m.id === matchId
          ? { ...m, team1_score: team1Score, team2_score: team2Score, status: "completed" }
          : m
      )
    );

    // Check if all matches in round are completed
    const allCompleted = matches.every((m) =>
      m.id === matchId ? true : m.status === "completed"
    );
    if (allCompleted) {
      const { data: round } = await supabase
        .from("rounds")
        .select("id")
        .eq("tournament_id", tournamentId)
        .eq("round_number", roundNum)
        .single();
      if (round) {
        await supabase
          .from("rounds")
          .update({ status: "completed" })
          .eq("id", round.id);
      }
    }

    setSaving(null);
  }

  if (loading) {
    return <SkeletonCards count={4} />;
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <h1 className="text-2xl font-bold text-gray-900">Round {roundNum}</h1>

      <div className="mt-6 space-y-4">
        {matches.map((match) => (
          <div
            key={match.id}
            className="rounded-lg border border-gray-200 bg-white p-4"
          >
            <div className="mb-3 flex items-center justify-between">
              <span className="text-sm font-medium text-gray-500">
                Court {match.court_number}
              </span>
              <span
                className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                  match.status === "completed"
                    ? "bg-green-100 text-green-700"
                    : "bg-gray-100 text-gray-700"
                }`}
              >
                {match.status}
              </span>
            </div>

            {/* Teams */}
            <div className="flex items-center justify-between gap-4">
              {/* Team 1 */}
              <div className="flex-1">
                <div className="space-y-1">
                  {match.team1Players.map((p) => (
                    <div key={p.id} className="flex items-center gap-2">
                      <span className="text-sm font-medium">{p.name}</span>
                      <Badge classification={p.classification} />
                    </div>
                  ))}
                </div>
              </div>

              {/* Score */}
              <div className="flex items-center gap-2 text-center">
                <select
                  value={scores[match.id] ?? 0}
                  onChange={(e) =>
                    setScores({
                      ...scores,
                      [match.id]: parseInt(e.target.value),
                    })
                  }
                  className="w-14 rounded border border-gray-300 bg-white px-2 py-1 text-center text-lg font-bold text-gray-900"
                >
                  {[0, 1, 2, 3, 4, 5].map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </select>
                <span className="text-gray-400">-</span>
                <span className="w-14 rounded border border-gray-200 bg-gray-50 px-2 py-1 text-center text-lg font-bold text-gray-500">
                  {5 - (scores[match.id] ?? 0)}
                </span>
              </div>

              {/* Team 2 */}
              <div className="flex-1 text-right">
                <div className="space-y-1">
                  {match.team2Players.map((p) => (
                    <div
                      key={p.id}
                      className="flex items-center justify-end gap-2"
                    >
                      <Badge classification={p.classification} />
                      <span className="text-sm font-medium">{p.name}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Save Button */}
            <div className="mt-3 flex justify-end">
              <Button
                size="sm"
                onClick={() => handleSaveScore(match.id)}
                disabled={saving === match.id}
              >
                {saving === match.id ? "Saving..." : "Save Score"}
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
