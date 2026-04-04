"use client";

import { Button } from "@/components/ui/Button";
import { useSupabase } from "@/components/providers/SupabaseProvider";
import type { Tournament } from "@/types/database";
import { SkeletonList } from "@/components/ui/Skeleton";
import { Plus, MoreVertical, Trophy, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export default function DashboardPage() {
  const { supabase, user, loading } = useSupabase();
  const router = useRouter();
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [fetching, setFetching] = useState(true);

  // Create modal state
  const [showModal, setShowModal] = useState(false);
  const [name, setName] = useState("");
  const [totalRounds, setTotalRounds] = useState("5");
  const [maxPlayers, setMaxPlayers] = useState("32");
  const [error, setError] = useState("");
  const [creating, setCreating] = useState(false);

  // Kebab menu / edit / delete state
  const [menuOpen, setMenuOpen] = useState<string | null>(null);
  const [editingTournament, setEditingTournament] = useState<Tournament | null>(null);
  const [editName, setEditName] = useState("");
  const [editRounds, setEditRounds] = useState("5");
  const [editPlayers, setEditPlayers] = useState("32");
  const [editError, setEditError] = useState("");
  const [editSaving, setEditSaving] = useState(false);
  const [deletingTournament, setDeletingTournament] = useState<Tournament | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (!user) return;

    async function fetchTournaments() {
      const { data } = await supabase
        .from("tournaments")
        .select("*")
        .eq("created_by", user!.id)
        .order("created_at", { ascending: false });

      setTournaments(data ?? []);
      setFetching(false);
    }

    fetchTournaments();
  }, [user, supabase]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    setError("");
    setCreating(true);

    const { data, error: dbError } = await supabase
      .from("tournaments")
      .insert({
        name: name.trim(),
        total_rounds: parseInt(totalRounds),
        max_players: parseInt(maxPlayers),
        status: "registration",
        created_by: user.id,
      })
      .select()
      .single();

    if (dbError) {
      setError(dbError.message);
      setCreating(false);
      return;
    }

    router.push(`/tournaments/${data.id}`);
  }

  async function handleEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editingTournament) return;
    setEditError("");
    setEditSaving(true);

    const { error: dbError } = await supabase
      .from("tournaments")
      .update({
        name: editName.trim(),
        total_rounds: parseInt(editRounds),
        max_players: parseInt(editPlayers),
      })
      .eq("id", editingTournament.id);

    if (dbError) {
      setEditError(dbError.message);
      setEditSaving(false);
      return;
    }

    setTournaments((prev) =>
      prev.map((t) =>
        t.id === editingTournament.id
          ? { ...t, name: editName.trim(), total_rounds: parseInt(editRounds) as 3 | 4 | 5, max_players: parseInt(editPlayers) as 8 | 16 | 32 | 64 }
          : t
      )
    );
    setEditingTournament(null);
    setEditSaving(false);
  }

  async function handleDelete() {
    if (!deletingTournament) return;
    setDeleting(true);

    await supabase.from("tournaments").delete().eq("id", deletingTournament.id);

    setTournaments((prev) => prev.filter((t) => t.id !== deletingTournament.id));
    setDeletingTournament(null);
    setDeleting(false);
  }

  if (loading || fetching) {
    return (
      <div className="flex flex-col h-[calc(100vh-3.5rem)] bg-white">
        <div className="bg-blue-600 px-4 py-4">
          <div className="h-5 w-40 animate-pulse rounded bg-blue-400" />
        </div>
        <SkeletonList rows={8} />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[calc(100vh-3.5rem)] bg-white">
      {/* Header */}
      <div className="bg-blue-600 px-4 py-4">
        <h1 className="text-lg font-bold text-white">All Tournaments</h1>
      </div>

      {/* Tournament List */}
      <div className="flex-1 overflow-y-auto">
        {tournaments.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-gray-400">
            <Trophy className="h-10 w-10 mb-2" />
            <p className="text-sm">No tournaments yet</p>
            <p className="text-xs mt-1">Tap + to create your first tournament</p>
          </div>
        ) : (
          <div>
            {tournaments.map((tournament) => (
              <div
                key={tournament.id}
                className="flex items-center justify-between border-b border-gray-100 px-4 py-4"
              >
                <Link
                  href={`/tournaments/${tournament.id}`}
                  className="flex-1 text-sm font-medium text-gray-900 hover:text-blue-600 transition-colors"
                >
                  {tournament.name}
                </Link>
                <div className="relative">
                  <button
                    onClick={() =>
                      setMenuOpen(menuOpen === tournament.id ? null : tournament.id)
                    }
                    className="p-1 text-gray-400 hover:text-gray-600 transition-colors cursor-pointer"
                  >
                    <MoreVertical className="h-4 w-4" />
                  </button>

                  {menuOpen === tournament.id && (
                    <>
                      <div
                        className="fixed inset-0 z-30"
                        onClick={() => setMenuOpen(null)}
                      />
                      <div className="absolute right-0 top-8 z-40 w-36 rounded-lg border border-gray-200 bg-white py-1 shadow-lg">
                        <button
                          onClick={() => {
                            setEditingTournament(tournament);
                            setEditName(tournament.name);
                            setEditRounds(String(tournament.total_rounds));
                            setEditPlayers(String(tournament.max_players));
                            setEditError("");
                            setMenuOpen(null);
                          }}
                          className="flex w-full items-center px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 cursor-pointer"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => {
                            setDeletingTournament(tournament);
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
        className="fixed bottom-6 right-6 z-30 flex h-14 w-14 items-center justify-center rounded-full bg-blue-600 text-white shadow-lg hover:bg-blue-700 transition-colors cursor-pointer"
      >
        <Plus className="h-6 w-6" />
      </button>

      {/* Edit Tournament Modal */}
      {editingTournament && (
        <div className="fixed inset-0 z-40 flex items-end sm:items-center justify-center bg-black/40">
          <div className="w-full max-w-md rounded-t-2xl sm:rounded-lg bg-white shadow-xl overflow-hidden">
            <div className="flex items-center justify-between bg-blue-600 px-5 py-4">
              <h2 className="text-base font-bold text-white">Edit tournament</h2>
              <button
                onClick={() => {
                  setEditingTournament(null);
                  setEditError("");
                }}
                className="text-white/80 hover:text-white cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={handleEdit} className="p-5 space-y-0">
              <div className="border-b border-gray-200 py-3">
                <input
                  type="text"
                  placeholder="Tournament name"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  required
                  className="w-full text-sm text-gray-900 bg-transparent outline-none placeholder:text-gray-400"
                />
              </div>
              <div className="flex items-center justify-between border-b border-gray-200 py-3">
                <span className="text-sm text-gray-500">No of players</span>
                <select
                  value={editPlayers}
                  onChange={(e) => setEditPlayers(e.target.value)}
                  className="text-sm font-medium text-gray-900 bg-transparent outline-none cursor-pointer"
                >
                  <option value="8">8 Players</option>
                  <option value="16">16 Players</option>
                  <option value="32">32 Players</option>
                  <option value="64">64 Players</option>
                </select>
              </div>
              <div className="flex items-center justify-between border-b border-gray-200 py-3">
                <span className="text-sm text-gray-500">No of rounds</span>
                <select
                  value={editRounds}
                  onChange={(e) => setEditRounds(e.target.value)}
                  className="text-sm font-medium text-gray-900 bg-transparent outline-none cursor-pointer"
                >
                  <option value="3">3 Rounds</option>
                  <option value="4">4 Rounds</option>
                  <option value="5">5 Rounds</option>
                </select>
              </div>
              {editError && (
                <p className="pt-3 text-sm text-red-600">{editError}</p>
              )}
              <div className="pt-4">
                <Button
                  type="submit"
                  className="w-full bg-blue-500 hover:bg-blue-600"
                  disabled={editSaving}
                >
                  {editSaving ? "Saving..." : "SAVE"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deletingTournament && (
        <div className="fixed inset-0 z-40 flex items-end sm:items-center justify-center bg-black/40">
          <div className="w-full max-w-sm rounded-t-2xl sm:rounded-lg bg-white p-6 shadow-xl">
            <h2 className="text-lg font-bold text-gray-900">Delete tournament?</h2>
            <p className="mt-2 text-sm text-gray-500">
              Are you sure you want to delete <strong>{deletingTournament.name}</strong>? This action cannot be undone.
            </p>
            <div className="mt-5 flex gap-3 justify-end">
              <button
                onClick={() => setDeletingTournament(null)}
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

      {/* Add Tournament Modal */}
      {showModal && (
        <div className="fixed inset-0 z-40 flex items-end sm:items-center justify-center bg-black/40">
          <div className="w-full max-w-md rounded-t-2xl sm:rounded-lg bg-white shadow-xl overflow-hidden">
            {/* Modal Header */}
            <div className="flex items-center justify-between bg-blue-600 px-5 py-4">
              <h2 className="text-base font-bold text-white">Add tournament</h2>
              <button
                onClick={() => {
                  setShowModal(false);
                  setError("");
                  setName("");
                }}
                className="text-white/80 hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Modal Body */}
            <form onSubmit={handleCreate} className="p-5 space-y-0">
              <div className="border-b border-gray-200 py-3">
                <input
                  type="text"
                  placeholder="Tournament name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  className="w-full text-sm text-gray-900 bg-transparent outline-none placeholder:text-gray-400"
                />
              </div>

              <div className="flex items-center justify-between border-b border-gray-200 py-3">
                <span className="text-sm text-gray-500">No of players</span>
                <select
                  value={maxPlayers}
                  onChange={(e) => setMaxPlayers(e.target.value)}
                  className="text-sm font-medium text-gray-900 bg-transparent outline-none cursor-pointer"
                >
                  <option value="8">8 Players</option>
                  <option value="16">16 Players</option>
                  <option value="32">32 Players</option>
                  <option value="64">64 Players</option>
                </select>
              </div>

              <div className="flex items-center justify-between border-b border-gray-200 py-3">
                <span className="text-sm text-gray-500">No of rounds</span>
                <select
                  value={totalRounds}
                  onChange={(e) => setTotalRounds(e.target.value)}
                  className="text-sm font-medium text-gray-900 bg-transparent outline-none cursor-pointer"
                >
                  <option value="3">3 Rounds</option>
                  <option value="4">4 Rounds</option>
                  <option value="5">5 Rounds</option>
                </select>
              </div>

              {error && (
                <p className="pt-3 text-sm text-red-600">{error}</p>
              )}

              <div className="pt-4">
                <Button
                  type="submit"
                  className="w-full bg-blue-500 hover:bg-blue-600"
                  disabled={creating}
                >
                  {creating ? "Creating..." : "SUBMIT"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
