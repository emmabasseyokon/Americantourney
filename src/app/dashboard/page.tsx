"use client";

import { Button } from "@/components/ui/Button";
import { useSupabase } from "@/components/providers/SupabaseProvider";
import type { Tournament } from "@/types/database";
import { Plus, Trophy } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

const statusColors: Record<string, string> = {
  draft: "bg-gray-100 text-gray-700",
  registration: "bg-yellow-100 text-yellow-700",
  in_progress: "bg-blue-100 text-blue-700",
  completed: "bg-green-100 text-green-700",
};

export default function DashboardPage() {
  const { supabase, user, loading } = useSupabase();
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [fetching, setFetching] = useState(true);

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

  if (loading || fetching) {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-gray-500">Loading...</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">My Tournaments</h1>
        <Link href="/tournaments/new">
          <Button size="sm">
            <Plus className="mr-1 h-4 w-4" />
            New Tournament
          </Button>
        </Link>
      </div>

      {tournaments.length === 0 ? (
        <div className="mt-12 text-center">
          <Trophy className="mx-auto h-12 w-12 text-gray-300" />
          <h3 className="mt-4 text-lg font-medium text-gray-900">
            No tournaments yet
          </h3>
          <p className="mt-1 text-sm text-gray-500">
            Create your first tournament to get started.
          </p>
          <div className="mt-6">
            <Link href="/tournaments/new">
              <Button>Create Tournament</Button>
            </Link>
          </div>
        </div>
      ) : (
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          {tournaments.map((tournament) => (
            <Link
              key={tournament.id}
              href={`/tournaments/${tournament.id}`}
              className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm transition hover:shadow-md"
            >
              <div className="flex items-start justify-between">
                <h3 className="font-semibold text-gray-900">
                  {tournament.name}
                </h3>
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusColors[tournament.status]}`}
                >
                  {tournament.status.replace("_", " ")}
                </span>
              </div>
              <div className="mt-2 flex gap-4 text-sm text-gray-500">
                <span>{tournament.total_rounds} rounds</span>
                <span>{tournament.max_players} players</span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
