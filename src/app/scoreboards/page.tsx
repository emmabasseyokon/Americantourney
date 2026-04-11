"use client";

import { Button } from "@/components/ui/Button";
import { useSupabase } from "@/components/providers/SupabaseProvider";
import { SkeletonList } from "@/components/ui/Skeleton";
import { sanitizeString } from "@/lib/utils/security";
import { createInitialState, formatMatchScore } from "@/lib/scoreboard/tennis";
import type { Scoreboard } from "@/lib/scoreboard/tennis";
import { Plus, MoreVertical, X, Activity, Share2, Copy } from "lucide-react";
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
  const [sportType, setSportType] = useState<"tennis" | "padel">("tennis");
  const [goldenPoint, setGoldenPoint] = useState(false);
  const [courtName, setCourtName] = useState("");
  const [error, setError] = useState("");
  const [creating, setCreating] = useState(false);

  // Share state
  const [copied, setCopied] = useState(false);

  // Edit state
  const [editingScoreboard, setEditingScoreboard] = useState<Scoreboard | null>(null);

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
        sport_type: sportType,
        golden_point: goldenPoint,
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
    closeModal();
  }

  function handleEdit(sb: Scoreboard) {
    setEditingScoreboard(sb);
    setPlayer1Name(sb.player1_name);
    setPlayer2Name(sb.player2_name);
    setBestOf(String(sb.best_of));
    setSportType(sb.sport_type);
    setGoldenPoint(sb.golden_point);
    setCourtName(sb.court_name ?? "");
    setError("");
    setShowModal(true);
  }

  async function handleSaveEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editingScoreboard) return;
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

    const { error: dbError } = await supabase
      .from("scoreboards")
      .update({
        player1_name: cleanP1,
        player2_name: cleanP2,
        best_of: parseInt(bestOf),
        sport_type: sportType,
        golden_point: goldenPoint,
        court_name: cleanCourt,
      })
      .eq("id", editingScoreboard.id);

    if (dbError) {
      setError(dbError.message);
      setCreating(false);
      return;
    }

    setScoreboards((prev) =>
      prev.map((s) =>
        s.id === editingScoreboard.id
          ? { ...s, player1_name: cleanP1, player2_name: cleanP2, best_of: parseInt(bestOf) as 3 | 5, sport_type: sportType, golden_point: goldenPoint, court_name: cleanCourt }
          : s
      )
    );
    closeModal();
  }

  function closeModal() {
    setShowModal(false);
    setEditingScoreboard(null);
    setError("");
    setPlayer1Name("");
    setPlayer2Name("");
    setSportType("tennis");
    setGoldenPoint(false);
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
        <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-text-muted">
          Completed
        </span>
      );
    return (
      <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-600">
        Pending
      </span>
    );
  }

  function copyShareLink() {
    const url = `${window.location.origin}/scoreboards/live`;
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  if (loading || fetching) {
    return (
      <div className="flex flex-col h-[calc(100vh-3.5rem)] bg-surface">
        <div className="bg-blue-600 px-4 py-4">
          <div className="h-5 w-40 animate-pulse rounded bg-blue-400" />
        </div>
        <SkeletonList rows={8} />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[calc(100vh-3.5rem)] bg-surface">
      {/* Header */}
      <div className="bg-blue-600 px-4 py-4 flex items-center justify-between">
        <h1 className="text-lg font-bold text-white">Scoreboards</h1>
        <button
          onClick={copyShareLink}
          className="flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-medium text-white/90 hover:bg-blue-500 transition-colors cursor-pointer"
        >
          {copied ? (
            <>
              <Copy className="h-3.5 w-3.5" /> Copied
            </>
          ) : (
            <>
              <Share2 className="h-3.5 w-3.5" /> Share
            </>
          )}
        </button>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto">
        {scoreboards.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-text-tertiary">
            <Activity className="h-10 w-10 mb-2" />
            <p className="text-sm">No scoreboards yet</p>
            <p className="text-xs mt-1">Tap + to create your first match</p>
          </div>
        ) : (
          <div>
            {scoreboards.map((sb) => (
              <div
                key={sb.id}
                className="flex items-center justify-between border-b border-border-light px-4 py-4"
              >
                <Link
                  href={`/scoreboards/${sb.id}`}
                  className="flex-1 min-w-0"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-text-primary truncate">
                      {sb.player1_name} vs {sb.player2_name}
                    </span>
                    {getStatusBadge(sb.status)}
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-xs text-text-tertiary capitalize">
                      {sb.sport_type} — Best of {sb.best_of}
                    </span>
                    {sb.court_name && (
                      <span className="text-xs text-text-tertiary">
                        — {sb.court_name}
                      </span>
                    )}
                    {sb.status !== "pending" && (
                      <span className="text-xs font-medium text-text-muted">
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
                    className="p-1 text-text-tertiary hover:text-text-secondary transition-colors cursor-pointer"
                  >
                    <MoreVertical className="h-4 w-4" />
                  </button>

                  {menuOpen === sb.id && (
                    <>
                      <div
                        className="fixed inset-0 z-30"
                        onClick={() => setMenuOpen(null)}
                      />
                      <div className="absolute right-0 top-8 z-40 w-36 rounded-lg border border-border-theme bg-surface py-1 shadow-lg">
                        {sb.status === "pending" && (
                          <button
                            onClick={() => {
                              handleEdit(sb);
                              setMenuOpen(null);
                            }}
                            className="flex w-full items-center px-4 py-2.5 text-sm text-text-primary hover:bg-surface-secondary cursor-pointer"
                          >
                            Edit
                          </button>
                        )}
                        <button
                          onClick={() => {
                            setDeletingScoreboard(sb);
                            setMenuOpen(null);
                          }}
                          className="flex w-full items-center px-4 py-2.5 text-sm text-red-600 hover:bg-surface-secondary cursor-pointer"
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
        className="fixed bottom-6 right-6 z-30 flex h-14 w-14 items-center justify-center rounded-full bg-blue-600 text-white shadow-lg hover:bg-blue-700 transition-colors cursor-pointer"
      >
        <Plus className="h-6 w-6" />
      </button>

      {/* Delete Confirmation Modal */}
      {deletingScoreboard && (
        <div className="fixed inset-0 z-40 flex items-end sm:items-center justify-center bg-black/40">
          <div className="w-full max-w-sm rounded-t-2xl sm:rounded-lg bg-surface p-6 shadow-xl">
            <h2 className="text-lg font-bold text-text-primary">Delete scoreboard?</h2>
            <p className="mt-2 text-sm text-text-muted">
              Are you sure you want to delete{" "}
              <strong>
                {deletingScoreboard.player1_name} vs {deletingScoreboard.player2_name}
              </strong>
              ? This action cannot be undone.
            </p>
            <div className="mt-5 flex gap-3 justify-end">
              <button
                onClick={() => setDeletingScoreboard(null)}
                className="rounded-lg px-4 py-2 text-sm font-medium text-text-secondary hover:bg-gray-100 transition-colors cursor-pointer"
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
          <div className="w-full max-w-md rounded-t-2xl sm:rounded-lg bg-surface shadow-xl overflow-hidden">
            <div className="flex items-center justify-between bg-blue-600 px-5 py-4">
              <h2 className="text-base font-bold text-white">
                {editingScoreboard ? "Edit Match" : "New Match"}
              </h2>
              <button
                onClick={closeModal}
                className="text-white/80 hover:text-white cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={editingScoreboard ? handleSaveEdit : handleCreate} className="p-5 space-y-0">
              <div className="border-b border-border-theme py-3">
                <input
                  type="text"
                  placeholder="Player 1 name"
                  value={player1Name}
                  onChange={(e) => setPlayer1Name(e.target.value)}
                  required
                  className="w-full text-sm text-text-primary bg-transparent outline-none placeholder:text-text-tertiary"
                />
              </div>

              <div className="border-b border-border-theme py-3">
                <input
                  type="text"
                  placeholder="Player 2 name"
                  value={player2Name}
                  onChange={(e) => setPlayer2Name(e.target.value)}
                  required
                  className="w-full text-sm text-text-primary bg-transparent outline-none placeholder:text-text-tertiary"
                />
              </div>

              <div className="flex items-center justify-between border-b border-border-theme py-3">
                <span className="text-sm text-text-muted">Sport</span>
                <select
                  value={sportType}
                  onChange={(e) => {
                    const val = e.target.value as "tennis" | "padel";
                    setSportType(val);
                    if (val === "padel") setGoldenPoint(true);
                    else setGoldenPoint(false);
                  }}
                  className="text-sm font-medium text-text-primary bg-transparent outline-none cursor-pointer"
                >
                  <option value="tennis">Tennis</option>
                  <option value="padel">Padel</option>
                </select>
              </div>

              <div className="flex items-center justify-between border-b border-border-theme py-3">
                <span className="text-sm text-text-muted">Format</span>
                <select
                  value={bestOf}
                  onChange={(e) => setBestOf(e.target.value)}
                  className="text-sm font-medium text-text-primary bg-transparent outline-none cursor-pointer"
                >
                  <option value="3">Best of 3</option>
                  <option value="5">Best of 5</option>
                </select>
              </div>

              <div className="flex items-center justify-between border-b border-border-theme py-3">
                <span className="text-sm text-text-muted">Golden Point</span>
                <button
                  type="button"
                  onClick={() => setGoldenPoint(!goldenPoint)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors cursor-pointer ${
                    goldenPoint ? "bg-blue-600" : "bg-gray-300"
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 rounded-full bg-white transition-transform ${
                      goldenPoint ? "translate-x-6" : "translate-x-1"
                    }`}
                  />
                </button>
              </div>

              <div className="border-b border-border-theme py-3">
                <input
                  type="text"
                  placeholder="Court name (optional)"
                  value={courtName}
                  onChange={(e) => setCourtName(e.target.value)}
                  className="w-full text-sm text-text-primary bg-transparent outline-none placeholder:text-text-tertiary"
                />
              </div>

              {error && (
                <p className="pt-3 text-sm text-red-600">{error}</p>
              )}

              <div className="pt-4">
                <Button
                  type="submit"
                  className="w-full bg-blue-600 hover:bg-blue-700"
                  disabled={creating}
                >
                  {creating
                    ? (editingScoreboard ? "Saving..." : "Creating...")
                    : (editingScoreboard ? "SAVE CHANGES" : "CREATE MATCH")}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
