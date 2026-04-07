"use client";

import { createClient } from "@/lib/supabase/client";
import { SkeletonList } from "@/components/ui/Skeleton";
import { formatGameScore, formatMatchScore } from "@/lib/scoreboard/tennis";
import type { Scoreboard, ScoreState } from "@/lib/scoreboard/tennis";
import { Activity, Trophy } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

export default function ScoreboardsLivePage() {
  const supabase = useMemo(() => createClient(), []);
  const [scoreboards, setScoreboards] = useState<Scoreboard[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchLive() {
      const { data } = await supabase
        .from("scoreboards")
        .select("*")
        .in("status", ["in_progress", "pending"])
        .order("updated_at", { ascending: false });

      setScoreboards(data ?? []);
      setLoading(false);
    }

    fetchLive();

    const channel = supabase
      .channel("scoreboards-live-list")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "scoreboards",
        },
        () => {
          // Refetch on any change
          fetchLive();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900">
        <div className="bg-gray-800 px-4 py-4 border-b border-gray-700">
          <div className="h-5 w-40 animate-pulse rounded bg-gray-600" />
        </div>
        <SkeletonList rows={6} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900">
      {/* Header */}
      <div className="bg-gray-800 px-4 py-4 border-b border-gray-700">
        <h1 className="text-lg font-bold text-white">Live Matches</h1>
      </div>

      {scoreboards.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-gray-500">
          <Activity className="h-10 w-10 mb-2" />
          <p className="text-sm">No live matches right now</p>
        </div>
      ) : (
        <div className="p-4 space-y-3">
          {scoreboards.map((sb) => (
            <MatchCard key={sb.id} scoreboard={sb} />
          ))}
        </div>
      )}
    </div>
  );
}

function MatchCard({ scoreboard }: { scoreboard: Scoreboard }) {
  const state: ScoreState = scoreboard.score_state;
  const gameScore = formatGameScore(state);
  const isLive = scoreboard.status === "in_progress";

  return (
    <Link
      href={`/scoreboards/${scoreboard.id}/live`}
      className="block rounded-xl bg-gray-800 border border-gray-700 p-4 hover:border-gray-600 transition-colors"
    >
      {/* Status + court */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          {isLive ? (
            <div className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
              <span className="text-xs font-bold text-green-400 uppercase">Live</span>
            </div>
          ) : (
            <span className="text-xs font-bold text-amber-400 uppercase">Pending</span>
          )}
          {scoreboard.court_name && (
            <span className="text-xs text-gray-500">{scoreboard.court_name}</span>
          )}
        </div>
        <span className="text-xs text-gray-500">Best of {scoreboard.best_of}</span>
      </div>

      {/* Player 1 */}
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2">
          {state.server === 1 && isLive && (
            <span className="h-1.5 w-1.5 rounded-full bg-green-400 flex-shrink-0" />
          )}
          <span className="text-sm font-semibold text-white uppercase">
            {scoreboard.player1_name}
          </span>
        </div>
        <div className="flex items-center gap-3">
          {state.sets.map((set, i) => (
            <span key={i} className={`text-sm font-bold w-4 text-center ${set.p1 > set.p2 ? "text-white" : "text-gray-500"}`}>
              {set.p1}
            </span>
          ))}
          {isLive && (
            <>
              <span className="text-sm font-bold w-4 text-center text-white">
                {state.currentSet.p1}
              </span>
              <span className={`text-sm font-bold w-5 text-center ${state.isTiebreak ? "text-blue-400" : "text-green-400"}`}>
                {gameScore.p1}
              </span>
            </>
          )}
        </div>
      </div>

      {/* Player 2 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {state.server === 2 && isLive && (
            <span className="h-1.5 w-1.5 rounded-full bg-green-400 flex-shrink-0" />
          )}
          <span className="text-sm font-semibold text-white uppercase">
            {scoreboard.player2_name}
          </span>
        </div>
        <div className="flex items-center gap-3">
          {state.sets.map((set, i) => (
            <span key={i} className={`text-sm font-bold w-4 text-center ${set.p2 > set.p1 ? "text-white" : "text-gray-500"}`}>
              {set.p2}
            </span>
          ))}
          {isLive && (
            <>
              <span className="text-sm font-bold w-4 text-center text-white">
                {state.currentSet.p2}
              </span>
              <span className={`text-sm font-bold w-5 text-center ${state.isTiebreak ? "text-blue-400" : "text-green-400"}`}>
                {gameScore.p2}
              </span>
            </>
          )}
        </div>
      </div>
    </Link>
  );
}
