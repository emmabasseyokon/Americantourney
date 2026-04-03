"use client";

import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Badge } from "@/components/ui/Badge";
import { useSupabase } from "@/components/providers/SupabaseProvider";
import type { Tournament, Player, Classification, Gender } from "@/types/database";
import { Trash2 } from "lucide-react";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";

export default function PlayersPage() {
  const { supabase } = useSupabase();
  const params = useParams();
  const tournamentId = params.id as string;

  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [name, setName] = useState("");
  const [gender, setGender] = useState<Gender>("male");
  const [classification, setClassification] = useState<Classification>("B");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    const [tournamentRes, playersRes] = await Promise.all([
      supabase.from("tournaments").select("*").eq("id", tournamentId).single(),
      supabase
        .from("players")
        .select("*")
        .eq("tournament_id", tournamentId)
        .order("created_at"),
    ]);
    setTournament(tournamentRes.data);
    setPlayers(playersRes.data ?? []);
  }

  async function handleAddPlayer(e: React.FormEvent) {
    e.preventDefault();
    if (!tournament) return;

    if (players.length >= tournament.max_players) {
      setError(`Maximum ${tournament.max_players} players reached.`);
      return;
    }

    setError("");
    setLoading(true);

    const { data, error: dbError } = await supabase
      .from("players")
      .insert({
        tournament_id: tournamentId,
        name: name.trim(),
        gender,
        classification,
      })
      .select()
      .single();

    if (dbError) {
      setError(dbError.message);
      setLoading(false);
      return;
    }

    setPlayers([...players, data]);
    setName("");
    setLoading(false);
  }

  async function handleDeletePlayer(playerId: string) {
    await supabase.from("players").delete().eq("id", playerId);
    setPlayers(players.filter((p) => p.id !== playerId));
  }

  if (!tournament) {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-gray-500">Loading...</p>
      </div>
    );
  }

  const isFull = players.length >= tournament.max_players;

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <h1 className="text-2xl font-bold text-gray-900">Players</h1>
      <p className="mt-1 text-sm text-gray-500">
        {players.length}/{tournament.max_players} registered
      </p>

      {/* Add Player Form */}
      {!isFull && (
        <form
          onSubmit={handleAddPlayer}
          className="mt-6 rounded-lg border border-gray-200 bg-white p-4"
        >
          <h2 className="font-semibold text-gray-900">Add Player</h2>
          <div className="mt-3 grid gap-3 sm:grid-cols-4">
            <div className="sm:col-span-2">
              <Input
                id="playerName"
                placeholder="Player name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>
            <Select
              id="gender"
              value={gender}
              onChange={(e) => setGender(e.target.value as Gender)}
              options={[
                { value: "male", label: "Male" },
                { value: "female", label: "Female" },
              ]}
            />
            <Select
              id="classification"
              value={classification}
              onChange={(e) =>
                setClassification(e.target.value as Classification)
              }
              options={[
                { value: "A+", label: "A+" },
                { value: "A", label: "A" },
                { value: "B+", label: "B+" },
                { value: "B", label: "B" },
                { value: "C+", label: "C+" },
                { value: "C", label: "C" },
              ]}
            />
          </div>
          {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
          <Button type="submit" size="sm" className="mt-3" disabled={loading}>
            {loading ? "Adding..." : "Add Player"}
          </Button>
        </form>
      )}

      {isFull && (
        <div className="mt-6 rounded-lg bg-green-50 border border-green-200 p-3 text-sm text-green-700">
          All {tournament.max_players} player slots are filled. Ready to generate draws!
        </div>
      )}

      {/* Player List */}
      <div className="mt-6 space-y-2">
        {players.map((player, index) => (
          <div
            key={player.id}
            className="flex items-center justify-between rounded-lg border border-gray-200 bg-white px-4 py-2.5"
          >
            <div className="flex items-center gap-3">
              <span className="text-xs font-medium text-gray-400 w-5">
                {index + 1}
              </span>
              <span className="font-medium text-gray-900">{player.name}</span>
              <span className="text-xs text-gray-500 capitalize">
                {player.gender}
              </span>
              <Badge classification={player.classification} />
            </div>
            <button
              onClick={() => handleDeletePlayer(player.id)}
              className="text-gray-400 hover:text-red-500 transition-colors"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
