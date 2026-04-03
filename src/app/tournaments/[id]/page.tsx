"use client";

import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { useSupabase } from "@/components/providers/SupabaseProvider";
import type { Tournament, Player, Round } from "@/types/database";
import { Users, Shuffle, BarChart3, Share2, Copy } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";

export default function TournamentDetailPage() {
  const { supabase } = useSupabase();
  const params = useParams();
  const tournamentId = params.id as string;

  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [rounds, setRounds] = useState<Round[]>([]);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    async function fetchData() {
      const [tournamentRes, playersRes, roundsRes] = await Promise.all([
        supabase.from("tournaments").select("*").eq("id", tournamentId).single(),
        supabase
          .from("players")
          .select("*")
          .eq("tournament_id", tournamentId)
          .order("created_at"),
        supabase
          .from("rounds")
          .select("*")
          .eq("tournament_id", tournamentId)
          .order("round_number"),
      ]);

      setTournament(tournamentRes.data);
      setPlayers(playersRes.data ?? []);
      setRounds(roundsRes.data ?? []);
      setLoading(false);
    }

    fetchData();
  }, [supabase, tournamentId]);

  function copyShareLink() {
    const url = `${window.location.origin}/tournaments/${tournamentId}/live`;
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  if (loading || !tournament) {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-gray-500">Loading...</p>
      </div>
    );
  }

  const statusColors: Record<string, string> = {
    draft: "bg-gray-100 text-gray-700",
    registration: "bg-yellow-100 text-yellow-700",
    in_progress: "bg-blue-100 text-blue-700",
    completed: "bg-green-100 text-green-700",
  };

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{tournament.name}</h1>
          <div className="mt-1 flex items-center gap-3 text-sm text-gray-500">
            <span
              className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusColors[tournament.status]}`}
            >
              {tournament.status.replace("_", " ")}
            </span>
            <span>{tournament.total_rounds} rounds</span>
            <span>
              {players.length}/{tournament.max_players} players
            </span>
          </div>
        </div>

        <Button variant="secondary" size="sm" onClick={copyShareLink}>
          {copied ? (
            <>
              <Copy className="mr-1 h-4 w-4" /> Copied!
            </>
          ) : (
            <>
              <Share2 className="mr-1 h-4 w-4" /> Share Link
            </>
          )}
        </Button>
      </div>

      {/* Navigation Cards */}
      <div className="mt-8 grid gap-4 sm:grid-cols-3">
        <Link
          href={`/tournaments/${tournamentId}/players`}
          className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm transition hover:shadow-md"
        >
          <Users className="h-6 w-6 text-blue-600" />
          <h3 className="mt-3 font-semibold text-gray-900">Players</h3>
          <p className="mt-1 text-sm text-gray-500">
            {players.length}/{tournament.max_players} registered
          </p>
        </Link>

        <Link
          href={`/tournaments/${tournamentId}/draw`}
          className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm transition hover:shadow-md"
        >
          <Shuffle className="h-6 w-6 text-blue-600" />
          <h3 className="mt-3 font-semibold text-gray-900">Draw & Rounds</h3>
          <p className="mt-1 text-sm text-gray-500">
            {rounds.length}/{tournament.total_rounds} rounds generated
          </p>
        </Link>

        <Link
          href={`/tournaments/${tournamentId}/leaderboard`}
          className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm transition hover:shadow-md"
        >
          <BarChart3 className="h-6 w-6 text-blue-600" />
          <h3 className="mt-3 font-semibold text-gray-900">Leaderboard</h3>
          <p className="mt-1 text-sm text-gray-500">View rankings</p>
        </Link>
      </div>

      {/* Players Preview */}
      {players.length > 0 && (
        <div className="mt-8">
          <h2 className="text-lg font-semibold text-gray-900">
            Registered Players
          </h2>
          <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {players.map((player) => (
              <div
                key={player.id}
                className="flex items-center justify-between rounded-lg border border-gray-200 bg-white px-3 py-2"
              >
                <span className="text-sm font-medium text-gray-900">
                  {player.name}
                </span>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-500 capitalize">
                    {player.gender}
                  </span>
                  <Badge classification={player.classification} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Rounds */}
      {rounds.length > 0 && (
        <div className="mt-8">
          <h2 className="text-lg font-semibold text-gray-900">Rounds</h2>
          <div className="mt-3 space-y-2">
            {rounds.map((round) => (
              <Link
                key={round.id}
                href={`/tournaments/${tournamentId}/rounds/${round.round_number}`}
                className="flex items-center justify-between rounded-lg border border-gray-200 bg-white px-4 py-3 transition hover:shadow-sm"
              >
                <span className="font-medium text-gray-900">
                  Round {round.round_number}
                </span>
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusColors[round.status]}`}
                >
                  {round.status.replace("_", " ")}
                </span>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
