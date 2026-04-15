"use client";

import { createClient } from "@/lib/supabase/client";
import { SkeletonList } from "@/components/ui/Skeleton";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { TvModeButton } from "@/components/ui/TvModeButton";
import { useTvMode } from "@/hooks/useTvMode";
import { formatGameScore, formatMatchScore } from "@/lib/scoreboard/tennis";
import type { Scoreboard, ScoreState } from "@/lib/scoreboard/tennis";
import { Activity } from "lucide-react";
import Link from "next/link";
import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";

function TennisBall({ className = "h-3 w-3" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className}>
      <circle cx="12" cy="12" r="10" fill="#4ADE80" stroke="#16A34A" strokeWidth="1.5" />
      <path d="M6 3.5C9.5 7 9.5 17 6 20.5" stroke="#16A34A" strokeWidth="1.5" strokeLinecap="round" fill="none" />
      <path d="M18 3.5C14.5 7 14.5 17 18 20.5" stroke="#16A34A" strokeWidth="1.5" strokeLinecap="round" fill="none" />
    </svg>
  );
}

export default function ScoreboardsLivePage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-surface">
        <div className="bg-surface-secondary px-4 py-4 border-b border-border-theme">
          <div className="h-5 w-40 animate-pulse rounded bg-surface-tertiary" />
        </div>
        <SkeletonList rows={6} />
      </div>
    }>
      <ScoreboardsLiveContent />
    </Suspense>
  );
}

function ScoreboardsLiveContent() {
  const supabase = useMemo(() => createClient(), []);
  const searchParams = useSearchParams();
  const hostId = searchParams.get("host");
  const { isTvMode, controlsVisible, toggleTvMode } = useTvMode();
  const [scoreboards, setScoreboards] = useState<Scoreboard[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchLive() {
      let query = supabase
        .from("scoreboards")
        .select("*")
        .in("status", ["in_progress", "pending"])
        .order("created_at", { ascending: false });

      if (hostId) {
        query = query.eq("created_by", hostId);
      }

      const { data } = await query;
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
      <div className="min-h-screen bg-surface">
        <div className="bg-surface-secondary px-4 py-4 border-b border-border-theme">
          <div className="h-5 w-40 animate-pulse rounded bg-surface-tertiary" />
        </div>
        <SkeletonList rows={6} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface">
      <ThemeToggle tvAutoHide={isTvMode} controlsVisible={controlsVisible} />
      <TvModeButton isTvMode={isTvMode} controlsVisible={controlsVisible} onToggle={toggleTvMode} />
      {/* Header */}
      <div className="bg-surface-secondary px-4 py-4 border-b border-border-theme">
        <div className="mx-auto max-w-lg flex items-center justify-between">
          <h1 className="text-lg font-bold text-text-primary">Live Matches</h1>
        </div>
      </div>

      {scoreboards.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-text-muted">
          <Activity className="h-10 w-10 mb-2" />
          <p className="text-sm">No live matches right now</p>
        </div>
      ) : (
        <div className="mx-auto max-w-lg p-4 space-y-3">
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
      className="tv-match-card block rounded-xl bg-surface-secondary border border-border-theme p-4 hover:border-border-light transition-colors"
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
            <span className="text-xs text-text-muted">{scoreboard.court_name}</span>
          )}
        </div>
        <span className="text-xs text-text-muted">Best of {scoreboard.best_of}</span>
      </div>

      {/* Player 1 */}
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2">
          <span className="flex-shrink-0 w-3">
            {state.server === 1 && isLive && <TennisBall className="h-3 w-3" />}
          </span>
          <span className="tv-player-name text-sm font-semibold text-text-primary uppercase">
            {scoreboard.player1_name}
          </span>
        </div>
        <div className="flex items-center gap-3">
          {state.sets.map((set, i) => (
            <span key={i} className={`text-sm font-bold w-4 text-center ${set.p1 > set.p2 ? "text-text-primary" : "text-text-muted"}`}>
              {set.p1}
            </span>
          ))}
          {isLive && (
            <>
              <span className="text-sm font-bold w-4 text-center text-text-primary">
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
          <span className="flex-shrink-0 w-3">
            {state.server === 2 && isLive && <TennisBall className="h-3 w-3" />}
          </span>
          <span className="tv-player-name text-sm font-semibold text-text-primary uppercase">
            {scoreboard.player2_name}
          </span>
        </div>
        <div className="flex items-center gap-3">
          {state.sets.map((set, i) => (
            <span key={i} className={`text-sm font-bold w-4 text-center ${set.p2 > set.p1 ? "text-text-primary" : "text-text-muted"}`}>
              {set.p2}
            </span>
          ))}
          {isLive && (
            <>
              <span className="text-sm font-bold w-4 text-center text-text-primary">
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
