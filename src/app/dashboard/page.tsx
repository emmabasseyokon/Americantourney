"use client";

import { Button } from "@/components/ui/Button";
import { useSupabase } from "@/components/providers/SupabaseProvider";
import type { Tournament } from "@/types/database";
import { SkeletonList } from "@/components/ui/Skeleton";
import { Plus, ChevronRight, Trophy, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export default function DashboardPage() {
  const { supabase, user, loading } = useSupabase();
  const router = useRouter();
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [fetching, setFetching] = useState(true);

  // Modal state
  const [showModal, setShowModal] = useState(false);
  const [name, setName] = useState("");
  const [totalRounds, setTotalRounds] = useState("5");
  const [maxPlayers, setMaxPlayers] = useState("32");
  const [error, setError] = useState("");
  const [creating, setCreating] = useState(false);

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
              <Link
                key={tournament.id}
                href={`/tournaments/${tournament.id}`}
                className="flex items-center justify-between border-b border-gray-100 px-4 py-4 hover:bg-gray-50 transition-colors"
              >
                <span className="text-sm font-medium text-gray-900">
                  {tournament.name}
                </span>
                <ChevronRight className="h-4 w-4 text-gray-300" />
              </Link>
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

      {/* Add Tournament Modal */}
      {showModal && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40">
          <div className="w-full max-w-md rounded-lg bg-white shadow-xl overflow-hidden">
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
