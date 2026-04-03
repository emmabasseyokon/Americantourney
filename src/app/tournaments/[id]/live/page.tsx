"use client";

import { createClient } from "@/lib/supabase/client";
import type { Tournament, Round } from "@/types/database";
import { Trophy, BarChart3 } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";

export default function LiveTournamentPage() {
  const supabase = createClient();
  const params = useParams();
  const tournamentId = params.id as string;

  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [rounds, setRounds] = useState<Round[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      const [tRes, rRes] = await Promise.all([
        supabase.from("tournaments").select("*").eq("id", tournamentId).single(),
        supabase
          .from("rounds")
          .select("*")
          .eq("tournament_id", tournamentId)
          .order("round_number"),
      ]);
      setTournament(tRes.data);
      setRounds(rRes.data ?? []);
      setLoading(false);
    }
    fetchData();
  }, []);

  if (loading || !tournament) {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-gray-500">Loading...</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <div className="text-center">
        <Trophy className="mx-auto h-8 w-8 text-blue-600" />
        <h1 className="mt-2 text-2xl font-bold text-gray-900">
          {tournament.name}
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          {tournament.total_rounds} rounds &middot; {tournament.max_players}{" "}
          players
        </p>
      </div>

      <div className="mt-8 space-y-3">
        {rounds.map((round) => (
          <Link
            key={round.id}
            href={`/tournaments/${tournamentId}/live/rounds/${round.round_number}`}
            className="flex items-center justify-between rounded-lg border border-gray-200 bg-white px-4 py-3 transition hover:shadow-sm"
          >
            <span className="font-medium text-gray-900">
              Round {round.round_number}
            </span>
            <span
              className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                round.status === "completed"
                  ? "bg-green-100 text-green-700"
                  : round.status === "in_progress"
                    ? "bg-blue-100 text-blue-700"
                    : "bg-gray-100 text-gray-700"
              }`}
            >
              {round.status.replace("_", " ")}
            </span>
          </Link>
        ))}

        <Link
          href={`/tournaments/${tournamentId}/live/leaderboard`}
          className="flex items-center gap-3 rounded-lg border border-gray-200 bg-white px-4 py-3 transition hover:shadow-sm"
        >
          <BarChart3 className="h-5 w-5 text-blue-600" />
          <span className="font-medium text-gray-900">Rankings</span>
        </Link>
      </div>

      {rounds.length === 0 && (
        <p className="mt-8 text-center text-sm text-gray-500">
          No rounds have been generated yet. Check back soon!
        </p>
      )}
    </div>
  );
}
