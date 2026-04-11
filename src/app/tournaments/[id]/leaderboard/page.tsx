"use client";

import { Badge } from "@/components/ui/Badge";
import { useSupabase } from "@/components/providers/SupabaseProvider";
import { SkeletonTable } from "@/components/ui/Skeleton";
import { fetchAndCalculateRankings, type LeaderboardRow } from "@/lib/utils/matchups";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";

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

      const leaderboardRows = await fetchAndCalculateRankings(supabase, players, rounds);
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
      <h1 className="text-2xl font-bold text-text-primary">Leaderboard</h1>

      <div className="mt-6 overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-gray-200">
              <th className="px-3 py-2 font-semibold text-text-muted">#</th>
              <th className="px-3 py-2 font-semibold text-text-muted">Player</th>
              <th className="px-3 py-2 font-semibold text-text-muted">Class</th>
              {roundColumns.map((r) => (
                <th
                  key={r}
                  className="px-3 py-2 text-center font-semibold text-text-muted"
                >
                  R{r}
                </th>
              ))}
              <th className="px-3 py-2 text-center font-semibold text-text-primary">
                Total
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <tr
                key={row.player.id}
                className={`border-b border-gray-100 ${
                  ""
                }`}
              >
                <td className="px-3 py-2 font-medium text-text-tertiary">
                  {index + 1}
                </td>
                <td className="px-3 py-2 font-medium text-text-primary">
                  {row.player.name}
                </td>
                <td className="px-3 py-2">
                  <Badge classification={row.player.classification} />
                </td>
                {roundColumns.map((r) => (
                  <td key={r} className="px-3 py-2 text-center text-text-secondary">
                    {row.roundScores[r] !== undefined
                      ? row.roundScores[r]
                      : "—"}
                  </td>
                ))}
                <td className="px-3 py-2 text-center font-bold text-text-primary">
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
