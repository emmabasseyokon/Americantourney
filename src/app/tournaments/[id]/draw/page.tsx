"use client";

import { Button } from "@/components/ui/Button";
import { useSupabase } from "@/components/providers/SupabaseProvider";
import { generateRoundDraw, extractPairKeys } from "@/lib/draw/americano";
import type { Tournament, Player, Round, Match, MatchPlayer } from "@/types/database";
import { SkeletonCards } from "@/components/ui/Skeleton";
import { Shuffle } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";

export default function DrawPage() {
  const { supabase } = useSupabase();
  const params = useParams();
  const tournamentId = params.id as string;

  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [rounds, setRounds] = useState<Round[]>([]);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    const [tRes, pRes, rRes] = await Promise.all([
      supabase.from("tournaments").select("*").eq("id", tournamentId).single(),
      supabase.from("players").select("*").eq("tournament_id", tournamentId),
      supabase
        .from("rounds")
        .select("*")
        .eq("tournament_id", tournamentId)
        .order("round_number"),
    ]);
    setTournament(tRes.data);
    setPlayers(pRes.data ?? []);
    setRounds(rRes.data ?? []);
  }

  async function handleGenerateRound() {
    if (!tournament) return;
    setError("");
    setGenerating(true);

    const nextRoundNum = rounds.length + 1;

    if (nextRoundNum > tournament.total_rounds) {
      setError("All rounds have been generated.");
      setGenerating(false);
      return;
    }

    if (players.length < tournament.max_players) {
      setError(
        `Need ${tournament.max_players} players. Currently have ${players.length}.`
      );
      setGenerating(false);
      return;
    }

    try {
      // Get pairing history from existing rounds
      const pairingHistory = new Set<string>();

      if (rounds.length > 0) {
        const roundIds = rounds.map((r) => r.id);
        const { data: matches } = await supabase
          .from("matches")
          .select("id")
          .in("round_id", roundIds);

        if (matches && matches.length > 0) {
          const matchIds = matches.map((m) => m.id);
          const { data: matchPlayers } = await supabase
            .from("match_players")
            .select("match_id, player_id, team")
            .in("match_id", matchIds);

          if (matchPlayers) {
            // Group by match_id and team to find partnerships
            const teamMap = new Map<string, string[]>();
            for (const mp of matchPlayers) {
              const key = `${mp.match_id}:${mp.team}`;
              if (!teamMap.has(key)) teamMap.set(key, []);
              teamMap.get(key)!.push(mp.player_id);
            }
            for (const pair of teamMap.values()) {
              if (pair.length === 2) {
                pairingHistory.add([...pair].sort().join(":"));
              }
            }
          }
        }
      }

      // Generate the draw
      const draw = generateRoundDraw(players, nextRoundNum, pairingHistory);

      // Save round to database
      const { data: round, error: roundErr } = await supabase
        .from("rounds")
        .insert({
          tournament_id: tournamentId,
          round_number: nextRoundNum,
          status: "pending",
        })
        .select()
        .single();

      if (roundErr) throw roundErr;

      // Save matches and match_players
      for (const matchDraw of draw.matches) {
        const { data: match, error: matchErr } = await supabase
          .from("matches")
          .insert({
            round_id: round.id,
            court_number: matchDraw.courtNumber,
            team1_score: 0,
            team2_score: 0,
            status: "pending",
          })
          .select()
          .single();

        if (matchErr) throw matchErr;

        await supabase.from("match_players").insert([
          { match_id: match.id, player_id: matchDraw.team1.player1.id, team: 1 },
          { match_id: match.id, player_id: matchDraw.team1.player2.id, team: 1 },
          { match_id: match.id, player_id: matchDraw.team2.player1.id, team: 2 },
          { match_id: match.id, player_id: matchDraw.team2.player2.id, team: 2 },
        ]);
      }

      // Update tournament status if needed
      if (tournament.status === "registration") {
        await supabase
          .from("tournaments")
          .update({ status: "in_progress" })
          .eq("id", tournamentId);
      }

      await fetchData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate draw.");
    } finally {
      setGenerating(false);
    }
  }

  if (!tournament) {
    return <SkeletonCards count={4} />;
  }

  const canGenerate =
    rounds.length < tournament.total_rounds &&
    players.length >= tournament.max_players;

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <h1 className="text-2xl font-bold text-gray-900">Draw & Rounds</h1>
      <p className="mt-1 text-sm text-gray-500">
        {rounds.length}/{tournament.total_rounds} rounds generated
      </p>

      {canGenerate && (
        <div className="mt-6">
          <Button onClick={handleGenerateRound} disabled={generating}>
            <Shuffle className="mr-2 h-4 w-4" />
            {generating
              ? "Generating..."
              : `Generate Round ${rounds.length + 1}`}
          </Button>
        </div>
      )}

      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

      {/* Rounds List */}
      <div className="mt-6 space-y-2">
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
      </div>
    </div>
  );
}
