"use client";

import { Badge } from "@/components/ui/Badge";
import { useSupabase } from "@/components/providers/SupabaseProvider";
import { SkeletonTable } from "@/components/ui/Skeleton";
import type { Player } from "@/types/database";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";

interface LeaderboardRow {
  player: Player;
  roundScores: Record<number, number>;
  total: number;
}

export default function LeaderboardPage() {
  const { supabase } = useSupabase();
  const params = useParams();
  const tournamentId = params.id as string;

  const [rows, setRows] = useState<LeaderboardRow[]>([]);
  const [totalRounds, setTotalRounds] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchLeaderboard() {
    const [tRes, pRes, rRes] = await Promise.all([
      supabase.from("tournaments").select("total_rounds").eq("id", tournamentId).single(),
      supabase.from("players").select("*").eq("tournament_id", tournamentId),
      supabase
        .from("rounds")
        .select("*")
        .eq("tournament_id", tournamentId)
        .order("round_number"),
    ]);

    setTotalRounds(tRes.data?.total_rounds ?? 0);
    const players = pRes.data ?? [];
    const rounds = rRes.data ?? [];

    if (rounds.length === 0) {
      setRows(
        players.map((p) => ({ player: p, roundScores: {}, total: 0 }))
      );
      setLoading(false);
      return;
    }

    // Get all matches and match_players
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

    // Build round number lookup for matches
    const matchRoundMap = new Map<string, number>();
    for (const match of matches ?? []) {
      const round = rounds.find((r) => r.id === match.round_id);
      if (round) matchRoundMap.set(match.id, round.round_number);
    }

    // Calculate per-player per-round scores
    const playerScores = new Map<string, Record<number, number>>();
    for (const player of players) {
      playerScores.set(player.id, {});
    }

    for (const match of matches ?? []) {
      if (match.status !== "completed") continue;

      const roundNum = matchRoundMap.get(match.id);
      if (!roundNum) continue;

      const mps = (matchPlayers ?? []).filter((mp) => mp.match_id === match.id);
      for (const mp of mps) {
        const score = mp.team === 1 ? match.team1_score : match.team2_score;
        const scores = playerScores.get(mp.player_id);
        if (scores) {
          scores[roundNum] = score;
        }
      }
    }

    // Build rows
    const leaderboardRows: LeaderboardRow[] = players.map((player) => {
      const roundScores = playerScores.get(player.id) ?? {};
      const total = Object.values(roundScores).reduce((sum, s) => sum + s, 0);
      return { player, roundScores, total };
    });

    // Sort by total descending, then by highest single round, then alphabetical
    leaderboardRows.sort((a, b) => {
      if (b.total !== a.total) return b.total - a.total;
      const aMax = Math.max(0, ...Object.values(a.roundScores));
      const bMax = Math.max(0, ...Object.values(b.roundScores));
      if (bMax !== aMax) return bMax - aMax;
      return a.player.name.localeCompare(b.player.name);
    });

    setRows(leaderboardRows);
    setLoading(false);
    }
    fetchLeaderboard();
  }, [supabase, tournamentId]);

  if (loading) {
    return <SkeletonTable rows={6} cols={5} />;
  }

  const roundColumns = Array.from({ length: totalRounds }, (_, i) => i + 1);

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <h1 className="text-2xl font-bold text-gray-900">Leaderboard</h1>

      <div className="mt-6 overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-gray-200">
              <th className="px-3 py-2 font-semibold text-gray-500">#</th>
              <th className="px-3 py-2 font-semibold text-gray-500">Player</th>
              <th className="px-3 py-2 font-semibold text-gray-500">Class</th>
              {roundColumns.map((r) => (
                <th
                  key={r}
                  className="px-3 py-2 text-center font-semibold text-gray-500"
                >
                  R{r}
                </th>
              ))}
              <th className="px-3 py-2 text-center font-semibold text-gray-900">
                Total
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <tr
                key={row.player.id}
                className={`border-b border-gray-100 ${
                  index < 3 ? "bg-yellow-50/50" : ""
                }`}
              >
                <td className="px-3 py-2 font-medium text-gray-400">
                  {index + 1}
                </td>
                <td className="px-3 py-2 font-medium text-gray-900">
                  {row.player.name}
                </td>
                <td className="px-3 py-2">
                  <Badge classification={row.player.classification} />
                </td>
                {roundColumns.map((r) => (
                  <td key={r} className="px-3 py-2 text-center text-gray-600">
                    {row.roundScores[r] !== undefined
                      ? row.roundScores[r]
                      : "—"}
                  </td>
                ))}
                <td className="px-3 py-2 text-center font-bold text-gray-900">
                  {row.total}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
