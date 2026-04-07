"use client";

import { Button } from "@/components/ui/Button";
import { useSupabase } from "@/components/providers/SupabaseProvider";
import { SkeletonList } from "@/components/ui/Skeleton";
import { sanitizeString } from "@/lib/utils/security";
import { createInitialState, formatMatchScore } from "@/lib/scoreboard/tennis";
import type { Scoreboard } from "@/lib/scoreboard/tennis";
import { Plus, MoreVertical, X, Activity } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

export default function ScoreboardsPage() {
  const { supabase, user, loading } = useSupabase();
  const [scoreboards, setScoreboards] = useState<Scoreboard[]>([]);
  const [fetching, setFetching] = useState(true);

  // Create modal state
  const [showModal, setShowModal] = useState(false);
  const [player1Name, setPlayer1Name] = useState("");
  const [player2Name, setPlayer2Name] = useState("");
  const [bestOf, setBestOf] = useState("3");
  const [courtName, setCourtName] = useState("");
  const [error, setError] = useState("");
  const [creating, setCreating] = useState(false);

  // Menu state
  const [menuOpen, setMenuOpen] = useState<string | null>(null);
  const [deletingScoreboard, setDeletingScoreboard] = useState<Scoreboard | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (!user) return;

    async function fetchScoreboards() {
      const { data } = await supabase
        .from("scoreboards")
        .select("*")
        .eq("created_by", user!.id)
        .order("created_at", { ascending: false });

      setScoreboards(data ?? []);
      setFetching(false);
    }

    fetchScoreboards();
  }, [user, supabase]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    setError("");
    setCreating(true);

    const cleanP1 = sanitizeString(player1Name, 50);
    const cleanP2 = sanitizeString(player2Name, 50);
    if (!cleanP1 || !cleanP2) {
      setError("Both player names are required.");
      setCreating(false);
      return;
    }

    const cleanCourt = courtName ? sanitizeString(courtName, 50) : null;

    const { data, error: dbError } = await supabase
      .from("scoreboards")
      .insert({
        player1_name: cleanP1,
        player2_name: cleanP2,
        best_of: parseInt(bestOf),
        court_name: cleanCourt,
        score_state: createInitialState(),
        status: "pending",
        created_by: user.id,
      })
      .select()
      .single();

    if (dbError) {
      setError(dbError.message);
      setCreating(false);
      return;
    }

    setScoreboards([data, ...scoreboards]);
    setShowModal(false);
    setPlayer1Name("");
    setPlayer2Name("");
    setCourtName("");
    setCreating(false);
  }

  async function handleDelete() {
    if (!deletingScoreboard) return;
    setDeleting(true);

    await supabase.from("scoreboards").delete().eq("id", deletingScoreboard.id);

    setScoreboards((prev) => prev.filter((s) => s.id !== deletingScoreboard.id));
    setDeletingScoreboard(null);
    setDeleting(false);
  }

  function getStatusBadge(status: string) {
    if (status === "in_progress")
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
          <span className="h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse" />
          Live
        </span>
      );
    if (status === "completed")
      return (
        <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-500">
          Completed
        </span>
      );
    return (
      <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-600">
        Pending
      </span>
    );
  }

  if (loading || fetching) {
    return (
      <div className="flex flex-col h-[calc(100vh-3.5rem)] bg-white">
        <div className="bg-green-600 px-4 py-4">
          <div className="h-5 w-40 animate-pulse rounded bg-green-400" />
        </div>
        <SkeletonList rows={8} />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[calc(100vh-3.5rem)] bg-white">
      {/* Header */}
      <div className="bg-green-600 px-4 py-4">
        <h1 className="text-lg font-bold text-white">Tennis Scoreboards</h1>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto">
        {scoreboards.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-gray-400">
            <Activity className="h-10 w-10 mb-2" />
            <p className="text-sm">No scoreboards yet</p>
            <p className="text-xs mt-1">Tap + to create your first match</p>
          </div>
        ) : (
          <div>
            {scoreboards.map((sb) => (
              <div
                key={sb.id}
                className="flex items-center justify-between border-b border-gray-100 px-4 py-4"
              >
                <Link
                  href={`/scoreboards/${sb.id}`}
                  className="flex-1 min-w-0"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-gray-900 truncate">
                      {sb.player1_name} vs {sb.player2_name}
                    </span>
                    {getStatusBadge(sb.status)}
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-xs text-gray-400">
                      Best of {sb.best_of}
                    </span>
                    {sb.court_name && (
                      <span className="text-xs text-gray-400">
                        — {sb.court_name}
                      </span>
                    )}
                    {sb.status !== "pending" && (
                      <span className="text-xs font-medium text-gray-500">
                        {formatMatchScore(sb.score_state)}
                      </span>
                    )}
                  </div>
                </Link>
                <div className="relative ml-2">
                  <button
                    onClick={() =>
                      setMenuOpen(menuOpen === sb.id ? null : sb.id)
                    }
                    className="p-1 text-gray-400 hover:text-gray-600 transition-colors cursor-pointer"
                  >
                    <MoreVertical className="h-4 w-4" />
                  </button>

                  {menuOpen === sb.id && (
                    <>
                      <div
                        className="fixed inset-0 z-30"
                        onClick={() => setMenuOpen(null)}
                      />
                      <div className="absolute right-0 top-8 z-40 w-36 rounded-lg border border-gray-200 bg-white py-1 shadow-lg">
                        <button
                          onClick={() => {
                            setDeletingScoreboard(sb);
                            setMenuOpen(null);
                          }}
                          className="flex w-full items-center px-4 py-2.5 text-sm text-red-600 hover:bg-gray-50 cursor-pointer"
                        >
                          Delete
                        </button>
                      </div>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* FAB */}
      <button
        onClick={() => setShowModal(true)}
        className="fixed bottom-6 right-6 z-30 flex h-14 w-14 items-center justify-center rounded-full bg-green-600 text-white shadow-lg hover:bg-green-700 transition-colors cursor-pointer"
      >
        <Plus className="h-6 w-6" />
      </button>

      {/* Delete Confirmation Modal */}
      {deletingScoreboard && (
        <div className="fixed inset-0 z-40 flex items-end sm:items-center justify-center bg-black/40">
          <div className="w-full max-w-sm rounded-t-2xl sm:rounded-lg bg-white p-6 shadow-xl">
            <h2 className="text-lg font-bold text-gray-900">Delete scoreboard?</h2>
            <p className="mt-2 text-sm text-gray-500">
              Are you sure you want to delete{" "}
              <strong>
                {deletingScoreboard.player1_name} vs {deletingScoreboard.player2_name}
              </strong>
              ? This action cannot be undone.
            </p>
            <div className="mt-5 flex gap-3 justify-end">
              <button
                onClick={() => setDeletingScoreboard(null)}
                className="rounded-lg px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 transition-colors disabled:opacity-50 cursor-pointer"
              >
                {deleting ? "Deleting..." : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create Modal */}
      {showModal && (
        <div className="fixed inset-0 z-40 flex items-end sm:items-center justify-center bg-black/40">
          <div className="w-full max-w-md rounded-t-2xl sm:rounded-lg bg-white shadow-xl overflow-hidden">
            <div className="flex items-center justify-between bg-green-600 px-5 py-4">
              <h2 className="text-base font-bold text-white">New Match</h2>
              <button
                onClick={() => {
                  setShowModal(false);
                  setError("");
                  setPlayer1Name("");
                  setPlayer2Name("");
                  setCourtName("");
                }}
                className="text-white/80 hover:text-white cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleCreate} className="p-5 space-y-0">
              <div className="border-b border-gray-200 py-3">
                <input
                  type="text"
                  placeholder="Player 1 name"
                  value={player1Name}
                  onChange={(e) => setPlayer1Name(e.target.value)}
                  required
                  className="w-full text-sm text-gray-900 bg-transparent outline-none placeholder:text-gray-400"
                />
              </div>

              <div className="border-b border-gray-200 py-3">
                <input
                  type="text"
                  placeholder="Player 2 name"
                  value={player2Name}
                  onChange={(e) => setPlayer2Name(e.target.value)}
                  required
                  className="w-full text-sm text-gray-900 bg-transparent outline-none placeholder:text-gray-400"
                />
              </div>

              <div className="flex items-center justify-between border-b border-gray-200 py-3">
                <span className="text-sm text-gray-500">Format</span>
                <select
                  value={bestOf}
                  onChange={(e) => setBestOf(e.target.value)}
                  className="text-sm font-medium text-gray-900 bg-transparent outline-none cursor-pointer"
                >
                  <option value="3">Best of 3</option>
                  <option value="5">Best of 5</option>
                </select>
              </div>

              <div className="border-b border-gray-200 py-3">
                <input
                  type="text"
                  placeholder="Court name (optional)"
                  value={courtName}
                  onChange={(e) => setCourtName(e.target.value)}
                  className="w-full text-sm text-gray-900 bg-transparent outline-none placeholder:text-gray-400"
                />
              </div>

              {error && (
                <p className="pt-3 text-sm text-red-600">{error}</p>
              )}

              <div className="pt-4">
                <Button
                  type="submit"
                  className="w-full bg-green-500 hover:bg-green-600"
                  disabled={creating}
                >
                  {creating ? "Creating..." : "CREATE MATCH"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
