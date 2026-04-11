"use client";

import { Button } from "@/components/ui/Button";
import { useSupabase } from "@/components/providers/SupabaseProvider";
import { SkeletonList } from "@/components/ui/Skeleton";
import {
  awardPoint,
  undoPoint,
  formatGameScore,
  createInitialState,
} from "@/lib/scoreboard/tennis";
import type { Scoreboard, ScoreState } from "@/lib/scoreboard/tennis";
import { Undo2, Share2, Trophy } from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

export default function ScoreboardAdminPage() {
  const { supabase } = useSupabase();
  const params = useParams();
  const router = useRouter();
  const scoreboardId = params.id as string;

  const [scoreboard, setScoreboard] = useState<Scoreboard | null>(null);
  const [saving, setSaving] = useState(false);
  const [showShareToast, setShowShareToast] = useState(false);

  const fetchScoreboard = useCallback(async () => {
    const { data } = await supabase
      .from("scoreboards")
      .select("*")
      .eq("id", scoreboardId)
      .single();

    if (data) setScoreboard(data);
  }, [supabase, scoreboardId]);

  useEffect(() => {
    fetchScoreboard();
  }, [fetchScoreboard]);

  async function updateScore(newState: ScoreState) {
    if (!scoreboard) return;
    setSaving(true);

    const isComplete = !!newState.matchWinner;
    const updates: Record<string, unknown> = {
      score_state: newState,
      status: isComplete ? "completed" : "in_progress",
      updated_at: new Date().toISOString(),
    };
    if (isComplete) {
      updates.winner = newState.matchWinner;
    }

    const { error } = await supabase
      .from("scoreboards")
      .update(updates)
      .eq("id", scoreboard.id);

    if (!error) {
      setScoreboard({
        ...scoreboard,
        score_state: newState,
        status: isComplete ? "completed" : "in_progress",
        winner: isComplete ? (newState.matchWinner as 1 | 2) : null,
      });
    }
    setSaving(false);
  }

  function handlePoint(player: 1 | 2) {
    if (!scoreboard || scoreboard.score_state.matchWinner) return;

    // Auto-start match on first point
    const state = scoreboard.status === "pending"
      ? createInitialState()
      : scoreboard.score_state;

    const newState = awardPoint(state, player, scoreboard.best_of, scoreboard.golden_point);
    updateScore(newState);
  }

  function handleUndo() {
    if (!scoreboard) return;
    const newState = undoPoint(scoreboard.score_state);
    // If undo brings us back, also unset winner/completed if needed
    updateScore(newState);
  }

  async function handleShare() {
    const url = `${window.location.origin}/scoreboards/${scoreboardId}/live`;
    try {
      await navigator.clipboard.writeText(url);
      setShowShareToast(true);
      setTimeout(() => setShowShareToast(false), 2000);
    } catch {
      // Fallback: try share API
      if (navigator.share) {
        navigator.share({ title: "Live Scoreboard", url });
      }
    }
  }

  if (!scoreboard) {
    return <SkeletonList rows={6} />;
  }

  const state = scoreboard.score_state;
  const gameScore = formatGameScore(state);
  const isComplete = !!state.matchWinner;
  const winnerName =
    state.matchWinner === 1
      ? scoreboard.player1_name
      : state.matchWinner === 2
        ? scoreboard.player2_name
        : null;

  return (
    <div className="flex flex-col h-[calc(100vh-3.5rem)] bg-surface-secondary">
      {/* Header */}
      <div className="bg-blue-600 px-4 py-3 flex items-center justify-between">
        <div>
          <h1 className="text-sm font-bold text-white">
            {scoreboard.player1_name} vs {scoreboard.player2_name}
          </h1>
          {scoreboard.court_name && (
            <p className="text-xs text-blue-200">{scoreboard.court_name}</p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleShare}
            className="flex items-center gap-1 rounded-lg bg-blue-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-400 transition-colors cursor-pointer"
          >
            <Share2 className="h-3.5 w-3.5" />
            Share Live
          </button>
        </div>
      </div>

      {/* Share toast */}
      {showShareToast && (
        <div className="mx-4 mt-2 rounded-lg bg-green-50 border border-green-200 p-2 text-center text-xs text-green-700">
          Live link copied to clipboard!
        </div>
      )}

      {/* Winner banner */}
      {isComplete && (
        <div className="mx-4 mt-3 rounded-lg bg-amber-50 border border-amber-300 p-4 text-center">
          <Trophy className="h-8 w-8 text-amber-500 mx-auto mb-1" />
          <p className="text-lg font-bold text-text-primary">{winnerName} wins!</p>
          <p className="text-xs text-text-muted mt-1">
            {state.sets.map((s) => `${s.p1}-${s.p2}`).join(", ")}
          </p>
        </div>
      )}

      {/* Scoreboard */}
      <div className="mx-4 mt-4 rounded-xl bg-surface border border-border-theme shadow-sm overflow-hidden">
        {/* Score table header */}
        <div className="grid grid-cols-[1fr_repeat(var(--sets),2.5rem)_3rem] bg-surface-secondary border-b border-border-theme text-center text-xs font-bold text-text-tertiary uppercase tracking-wide"
          style={{
            "--sets": Math.max(state.sets.length + (isComplete ? 0 : 1), scoreboard.best_of),
            gridTemplateColumns: `1fr repeat(${Math.max(state.sets.length + (isComplete ? 0 : 1), scoreboard.best_of)}, 2.5rem) 3rem`,
          } as React.CSSProperties}
        >
          <div className="px-4 py-2 text-left">Player</div>
          {Array.from({ length: Math.max(state.sets.length + (isComplete ? 0 : 1), scoreboard.best_of) }).map((_, i) => (
            <div key={i} className="py-2">S{i + 1}</div>
          ))}
          {!isComplete && <div className="py-2">Pts</div>}
          {isComplete && <div className="py-2" />}
        </div>

        {/* Player 1 row */}
        <div
          className="grid border-b border-border-light text-center items-center"
          style={{
            gridTemplateColumns: `1fr repeat(${Math.max(state.sets.length + (isComplete ? 0 : 1), scoreboard.best_of)}, 2.5rem) 3rem`,
          }}
        >
          <div className="px-4 py-3 text-left flex items-center gap-2">
            {state.server === 1 && !isComplete && (
              <span className="h-2 w-2 rounded-full bg-green-500 flex-shrink-0" />
            )}
            <span className={`text-sm font-semibold uppercase truncate ${state.matchWinner === 1 ? "text-green-700" : "text-text-primary"}`}>
              {scoreboard.player1_name}
            </span>
            {state.matchWinner === 1 && (
              <Trophy className="h-3.5 w-3.5 text-amber-500 flex-shrink-0" />
            )}
          </div>
          {state.sets.map((set, i) => (
            <div key={i} className={`py-3 text-sm font-bold ${set.p1 > set.p2 ? "text-text-primary" : "text-text-tertiary"}`}>
              {set.p1}
            </div>
          ))}
          {!isComplete && (
            <div className="py-3 text-sm font-bold text-text-primary">
              {state.currentSet.p1}
            </div>
          )}
          {/* Pad empty set columns */}
          {Array.from({ length: Math.max(0, scoreboard.best_of - state.sets.length - (isComplete ? 0 : 1)) }).map((_, i) => (
            <div key={`pad-${i}`} className="py-3 text-sm text-text-tertiary">-</div>
          ))}
          {!isComplete && (
            <div className={`py-3 text-sm font-bold ${state.isTiebreak ? "text-blue-600" : "text-green-600"}`}>
              {gameScore.p1}
            </div>
          )}
          {isComplete && <div className="py-3" />}
        </div>

        {/* Player 2 row */}
        <div
          className="grid text-center items-center"
          style={{
            gridTemplateColumns: `1fr repeat(${Math.max(state.sets.length + (isComplete ? 0 : 1), scoreboard.best_of)}, 2.5rem) 3rem`,
          }}
        >
          <div className="px-4 py-3 text-left flex items-center gap-2">
            {state.server === 2 && !isComplete && (
              <span className="h-2 w-2 rounded-full bg-green-500 flex-shrink-0" />
            )}
            <span className={`text-sm font-semibold uppercase truncate ${state.matchWinner === 2 ? "text-green-700" : "text-text-primary"}`}>
              {scoreboard.player2_name}
            </span>
            {state.matchWinner === 2 && (
              <Trophy className="h-3.5 w-3.5 text-amber-500 flex-shrink-0" />
            )}
          </div>
          {state.sets.map((set, i) => (
            <div key={i} className={`py-3 text-sm font-bold ${set.p2 > set.p1 ? "text-text-primary" : "text-text-tertiary"}`}>
              {set.p2}
            </div>
          ))}
          {!isComplete && (
            <div className="py-3 text-sm font-bold text-text-primary">
              {state.currentSet.p2}
            </div>
          )}
          {Array.from({ length: Math.max(0, scoreboard.best_of - state.sets.length - (isComplete ? 0 : 1)) }).map((_, i) => (
            <div key={`pad-${i}`} className="py-3 text-sm text-text-tertiary">-</div>
          ))}
          {!isComplete && (
            <div className={`py-3 text-sm font-bold ${state.isTiebreak ? "text-blue-600" : "text-green-600"}`}>
              {gameScore.p2}
            </div>
          )}
          {isComplete && <div className="py-3" />}
        </div>
      </div>

      {/* Tiebreak indicator */}
      {state.isTiebreak && !isComplete && (
        <div className="mx-4 mt-2 text-center text-xs font-medium text-blue-600">
          Tiebreak
        </div>
      )}

      {/* Scoring buttons */}
      {!isComplete && (
        <div className="mx-4 mt-6 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => handlePoint(1)}
              disabled={saving}
              className="rounded-xl bg-blue-600 py-6 text-center text-sm font-bold text-white uppercase hover:bg-blue-700 transition-colors disabled:opacity-50 cursor-pointer shadow-sm"
            >
              Point<br />
              <span className="text-lg">{scoreboard.player1_name}</span>
            </button>
            <button
              onClick={() => handlePoint(2)}
              disabled={saving}
              className="rounded-xl bg-indigo-600 py-6 text-center text-sm font-bold text-white uppercase hover:bg-indigo-700 transition-colors disabled:opacity-50 cursor-pointer shadow-sm"
            >
              Point<br />
              <span className="text-lg">{scoreboard.player2_name}</span>
            </button>
          </div>

          <button
            onClick={handleUndo}
            disabled={saving || !state.history?.length}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-border-theme bg-surface py-3 text-sm font-medium text-text-secondary hover:bg-surface-secondary transition-colors disabled:opacity-30 cursor-pointer"
          >
            <Undo2 className="h-4 w-4" />
            Undo last point
          </button>
        </div>
      )}

      {/* Back to list */}
      <div className="mx-4 mt-6 mb-8">
        <Button
          variant="secondary"
          className="w-full"
          onClick={() => router.push("/scoreboards")}
        >
          Back to Scoreboards
        </Button>
      </div>
    </div>
  );
}
