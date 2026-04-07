"use client";

import { createClient } from "@/lib/supabase/client";
import { SkeletonList } from "@/components/ui/Skeleton";
import { formatGameScore } from "@/lib/scoreboard/tennis";
import type { Scoreboard, ScoreState } from "@/lib/scoreboard/tennis";
import { Trophy } from "lucide-react";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

export default function ScoreboardLivePage() {
  const supabase = useMemo(() => createClient(), []);
  const params = useParams();
  const scoreboardId = params.id as string;

  const [scoreboard, setScoreboard] = useState<Scoreboard | null>(null);

  useEffect(() => {
    async function fetchScoreboard() {
      const { data } = await supabase
        .from("scoreboards")
        .select("*")
        .eq("id", scoreboardId)
        .single();

      if (data) setScoreboard(data);
    }

    fetchScoreboard();

    const channel = supabase
      .channel(`scoreboard-live-${scoreboardId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "scoreboards",
          filter: `id=eq.${scoreboardId}`,
        },
        (payload) => {
          setScoreboard((prev) =>
            prev ? { ...prev, ...payload.new } as Scoreboard : prev
          );
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase, scoreboardId]);

  if (!scoreboard) {
    return <SkeletonList rows={4} />;
  }

  const state: ScoreState = scoreboard.score_state;
  const gameScore = formatGameScore(state);
  const isComplete = !!state.matchWinner;
  const winnerName =
    state.matchWinner === 1
      ? scoreboard.player1_name
      : state.matchWinner === 2
        ? scoreboard.player2_name
        : null;

  const totalSetCols = Math.max(
    state.sets.length + (isComplete ? 0 : 1),
    scoreboard.best_of
  );

  return (
    <div className="min-h-screen bg-gray-900 flex flex-col items-center justify-center px-4 py-8">
      {/* Status */}
      <div className="mb-4 text-center">
        {scoreboard.court_name && (
          <p className="text-xs font-medium text-gray-500 uppercase tracking-widest mb-1">
            {scoreboard.court_name}
          </p>
        )}
        {!isComplete && scoreboard.status === "in_progress" && (
          <div className="inline-flex items-center gap-1.5 rounded-full bg-green-500/10 px-3 py-1">
            <span className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
            <span className="text-xs font-bold text-green-400 uppercase tracking-wide">
              Live
            </span>
          </div>
        )}
        {scoreboard.status === "pending" && (
          <span className="text-xs font-bold text-amber-400 uppercase tracking-wide">
            Not Started
          </span>
        )}
      </div>

      {/* Winner banner */}
      {isComplete && (
        <div className="mb-6 text-center">
          <Trophy className="h-10 w-10 text-amber-400 mx-auto mb-2" />
          <p className="text-xl font-bold text-white">{winnerName} wins!</p>
        </div>
      )}

      {/* Scoreboard */}
      <div className="w-full max-w-lg rounded-2xl bg-gray-800 border border-gray-700 overflow-hidden shadow-2xl">
        {/* Header */}
        <div
          className="grid bg-gray-800 border-b border-gray-700 text-center text-xs font-bold text-gray-500 uppercase tracking-wide"
          style={{
            gridTemplateColumns: `1fr repeat(${totalSetCols}, 2.5rem) ${isComplete ? "" : "3rem"}`,
          }}
        >
          <div className="px-4 py-3 text-left">Player</div>
          {Array.from({ length: totalSetCols }).map((_, i) => (
            <div key={i} className="py-3">S{i + 1}</div>
          ))}
          {!isComplete && <div className="py-3">Pts</div>}
        </div>

        {/* Player 1 */}
        <div
          className="grid border-b border-gray-700/50 text-center items-center"
          style={{
            gridTemplateColumns: `1fr repeat(${totalSetCols}, 2.5rem) ${isComplete ? "" : "3rem"}`,
          }}
        >
          <div className="px-4 py-4 text-left flex items-center gap-2">
            {state.server === 1 && !isComplete && (
              <span className="h-2.5 w-2.5 rounded-full bg-green-400 flex-shrink-0" />
            )}
            <span className={`text-sm font-bold uppercase truncate ${state.matchWinner === 1 ? "text-green-400" : "text-white"}`}>
              {scoreboard.player1_name}
            </span>
            {state.matchWinner === 1 && (
              <Trophy className="h-3.5 w-3.5 text-amber-400 flex-shrink-0" />
            )}
          </div>
          {state.sets.map((set, i) => (
            <div key={i} className={`py-4 text-base font-bold ${set.p1 > set.p2 ? "text-white" : "text-gray-500"}`}>
              {set.p1}
            </div>
          ))}
          {!isComplete && (
            <div className="py-4 text-base font-bold text-white">
              {state.currentSet.p1}
            </div>
          )}
          {Array.from({ length: Math.max(0, scoreboard.best_of - state.sets.length - (isComplete ? 0 : 1)) }).map((_, i) => (
            <div key={`pad-${i}`} className="py-4 text-base text-gray-700">-</div>
          ))}
          {!isComplete && (
            <div className={`py-4 text-base font-bold ${state.isTiebreak ? "text-blue-400" : "text-green-400"}`}>
              {gameScore.p1}
            </div>
          )}
        </div>

        {/* Player 2 */}
        <div
          className="grid text-center items-center"
          style={{
            gridTemplateColumns: `1fr repeat(${totalSetCols}, 2.5rem) ${isComplete ? "" : "3rem"}`,
          }}
        >
          <div className="px-4 py-4 text-left flex items-center gap-2">
            {state.server === 2 && !isComplete && (
              <span className="h-2.5 w-2.5 rounded-full bg-green-400 flex-shrink-0" />
            )}
            <span className={`text-sm font-bold uppercase truncate ${state.matchWinner === 2 ? "text-green-400" : "text-white"}`}>
              {scoreboard.player2_name}
            </span>
            {state.matchWinner === 2 && (
              <Trophy className="h-3.5 w-3.5 text-amber-400 flex-shrink-0" />
            )}
          </div>
          {state.sets.map((set, i) => (
            <div key={i} className={`py-4 text-base font-bold ${set.p2 > set.p1 ? "text-white" : "text-gray-500"}`}>
              {set.p2}
            </div>
          ))}
          {!isComplete && (
            <div className="py-4 text-base font-bold text-white">
              {state.currentSet.p2}
            </div>
          )}
          {Array.from({ length: Math.max(0, scoreboard.best_of - state.sets.length - (isComplete ? 0 : 1)) }).map((_, i) => (
            <div key={`pad-${i}`} className="py-4 text-base text-gray-700">-</div>
          ))}
          {!isComplete && (
            <div className={`py-4 text-base font-bold ${state.isTiebreak ? "text-blue-400" : "text-green-400"}`}>
              {gameScore.p2}
            </div>
          )}
        </div>
      </div>

      {/* Tiebreak indicator */}
      {state.isTiebreak && !isComplete && (
        <div className="mt-3 text-center text-xs font-semibold text-blue-400 uppercase tracking-wide">
          Tiebreak
        </div>
      )}

      {/* Best of info */}
      <p className="mt-4 text-xs text-gray-600">
        Best of {scoreboard.best_of} sets
      </p>
    </div>
  );
}
