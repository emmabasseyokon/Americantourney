"use client";

import { useSupabase } from "@/components/providers/SupabaseProvider";
import type { Tournament } from "@/types/database";
import { Plus, ChevronRight, Trophy } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

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

      {/* FAB - New Tournament */}
      <Link
        href="/tournaments/new"
        className="fixed bottom-6 right-6 z-30 flex h-14 w-14 items-center justify-center rounded-full bg-blue-600 text-white shadow-lg hover:bg-blue-700 transition-colors"
      >
        <Plus className="h-6 w-6" />
      </Link>
    </div>
  );
}
