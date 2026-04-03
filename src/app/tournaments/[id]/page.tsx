"use client";

import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { useSupabase } from "@/components/providers/SupabaseProvider";
import { generateRoundDraw } from "@/lib/draw/americano";
import type {
  Tournament,
  Player,
  Round,
  Match,
  Classification,
  Gender,
} from "@/types/database";
import {
  ClipboardList,
  Swords,
  BarChart3,
  UserPlus,
  Trash2,
  Share2,
  Copy,
  Shuffle,
  X,
} from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";

type Tab = "players" | "matchups" | "rankings";

export default function TournamentDetailPage() {
  const { supabase } = useSupabase();
  const params = useParams();
  const tournamentId = params.id as string;

  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [rounds, setRounds] = useState<Round[]>([]);
  const [activeTab, setActiveTab] = useState<Tab>("players");
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  // Add player state
  const [showAddPlayer, setShowAddPlayer] = useState(false);
  const [playerName, setPlayerName] = useState("");
  const [playerGender, setPlayerGender] = useState<Gender>("male");
  const [playerClassification, setPlayerClassification] =
    useState<Classification>("B");
  const [addError, setAddError] = useState("");
  const [addLoading, setAddLoading] = useState(false);

  // Matchups state
  const [matchupData, setMatchupData] = useState<
    {
      round: Round;
      matches: (Match & { team1Players: Player[]; team2Players: Player[] })[];
    }[]
  >([]);
  const [generating, setGenerating] = useState(false);
  const [genError, setGenError] = useState("");

  // Rankings state
  const [rankings, setRankings] = useState<
    { player: Player; roundScores: Record<number, number>; total: number }[]
  >([]);

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    if (activeTab === "matchups" && rounds.length > 0) {
      fetchMatchups();
    }
    if (activeTab === "rankings") {
      fetchRankings();
    }
  }, [activeTab, rounds]);

  async function fetchData() {
    const [tRes, pRes, rRes] = await Promise.all([
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
    setTournament(tRes.data);
    setPlayers(pRes.data ?? []);
    setRounds(rRes.data ?? []);
    setLoading(false);
  }

  async function fetchMatchups() {
    if (rounds.length === 0) return;

    const roundIds = rounds.map((r) => r.id);
    const { data: matches } = await supabase
      .from("matches")
      .select("*")
      .in("round_id", roundIds)
      .order("court_number");

    if (!matches || matches.length === 0) {
      setMatchupData([]);
      return;
    }

    const matchIds = matches.map((m) => m.id);
    const { data: matchPlayers } = await supabase
      .from("match_players")
      .select("*")
      .in("match_id", matchIds);

    const playerMap = new Map(players.map((p) => [p.id, p]));

    const grouped = rounds.map((round) => {
      const roundMatches = matches
        .filter((m) => m.round_id === round.id)
        .map((match) => {
          const mps = (matchPlayers ?? []).filter(
            (mp) => mp.match_id === match.id
          );
          return {
            ...match,
            team1Players: mps
              .filter((mp) => mp.team === 1)
              .map((mp) => playerMap.get(mp.player_id)!)
              .filter(Boolean),
            team2Players: mps
              .filter((mp) => mp.team === 2)
              .map((mp) => playerMap.get(mp.player_id)!)
              .filter(Boolean),
          };
        });
      return { round, matches: roundMatches };
    });

    setMatchupData(grouped);
  }

  async function fetchRankings() {
    if (rounds.length === 0) {
      setRankings(
        players.map((p) => ({ player: p, roundScores: {}, total: 0 }))
      );
      return;
    }

    const roundIds = rounds.map((r) => r.id);
    const { data: matches } = await supabase
      .from("matches")
      .select("*")
      .in("round_id", roundIds);
    const matchIds = (matches ?? []).map((m) => m.id);
    const { data: matchPlayers } = await supabase
      .from("match_players")
      .select("*")
      .in("match_id", matchIds);

    const matchRoundMap = new Map<string, number>();
    for (const match of matches ?? []) {
      const round = rounds.find((r) => r.id === match.round_id);
      if (round) matchRoundMap.set(match.id, round.round_number);
    }

    const playerScores = new Map<string, Record<number, number>>();
    for (const player of players) {
      playerScores.set(player.id, {});
    }

    for (const match of matches ?? []) {
      if (match.status !== "completed") continue;
      const roundNum = matchRoundMap.get(match.id);
      if (!roundNum) continue;
      const mps = (matchPlayers ?? []).filter(
        (mp) => mp.match_id === match.id
      );
      for (const mp of mps) {
        const score = mp.team === 1 ? match.team1_score : match.team2_score;
        const scores = playerScores.get(mp.player_id);
        if (scores) scores[roundNum] = score;
      }
    }

    const rows = players.map((player) => {
      const roundScores = playerScores.get(player.id) ?? {};
      const total = Object.values(roundScores).reduce((s, v) => s + v, 0);
      return { player, roundScores, total };
    });

    rows.sort((a, b) => {
      if (b.total !== a.total) return b.total - a.total;
      const aMax = Math.max(0, ...Object.values(a.roundScores));
      const bMax = Math.max(0, ...Object.values(b.roundScores));
      if (bMax !== aMax) return bMax - aMax;
      return a.player.name.localeCompare(b.player.name);
    });

    setRankings(rows);
  }

  async function handleAddPlayer(e: React.FormEvent) {
    e.preventDefault();
    if (!tournament) return;
    if (players.length >= tournament.max_players) {
      setAddError(`Maximum ${tournament.max_players} players reached.`);
      return;
    }

    setAddError("");
    setAddLoading(true);

    const { data, error: dbError } = await supabase
      .from("players")
      .insert({
        tournament_id: tournamentId,
        name: playerName.trim(),
        gender: playerGender,
        classification: playerClassification,
      })
      .select()
      .single();

    if (dbError) {
      setAddError(dbError.message);
      setAddLoading(false);
      return;
    }

    setPlayers([...players, data]);
    setPlayerName("");
    setShowAddPlayer(false);
    setAddLoading(false);
  }

  async function handleDeletePlayer(playerId: string) {
    await supabase.from("players").delete().eq("id", playerId);
    setPlayers(players.filter((p) => p.id !== playerId));
  }

  async function handleGenerateAllRounds() {
    if (!tournament) return;
    setGenError("");
    setGenerating(true);

    if (rounds.length > 0) {
      setGenError("Rounds have already been generated.");
      setGenerating(false);
      return;
    }

    if (players.length < tournament.max_players) {
      setGenError(
        `Need ${tournament.max_players} players. Currently have ${players.length}.`
      );
      setGenerating(false);
      return;
    }

    try {
      const pairingHistory = new Set<string>();

      for (let roundNum = 1; roundNum <= tournament.total_rounds; roundNum++) {
        const draw = generateRoundDraw(players, roundNum, pairingHistory);

        // Track new pairs for subsequent rounds
        for (const matchDraw of draw.matches) {
          const p1 = [matchDraw.team1.player1.id, matchDraw.team1.player2.id]
            .sort()
            .join(":");
          const p2 = [matchDraw.team2.player1.id, matchDraw.team2.player2.id]
            .sort()
            .join(":");
          pairingHistory.add(p1);
          pairingHistory.add(p2);
        }

        const { data: round, error: roundErr } = await supabase
          .from("rounds")
          .insert({
            tournament_id: tournamentId,
            round_number: roundNum,
            status: "pending",
          })
          .select()
          .single();

        if (roundErr) throw roundErr;

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
            {
              match_id: match.id,
              player_id: matchDraw.team1.player1.id,
              team: 1,
            },
            {
              match_id: match.id,
              player_id: matchDraw.team1.player2.id,
              team: 1,
            },
            {
              match_id: match.id,
              player_id: matchDraw.team2.player1.id,
              team: 2,
            },
            {
              match_id: match.id,
              player_id: matchDraw.team2.player2.id,
              team: 2,
            },
          ]);
        }
      }

      await supabase
        .from("tournaments")
        .update({ status: "in_progress" })
        .eq("id", tournamentId);

      await fetchData();
    } catch (err) {
      setGenError(
        err instanceof Error ? err.message : "Failed to generate draws."
      );
    } finally {
      setGenerating(false);
    }
  }

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

  const isFull = players.length >= tournament.max_players;
  const canGenerate =
    rounds.length === 0 && players.length >= tournament.max_players;
  const roundColumns = Array.from(
    { length: tournament.total_rounds },
    (_, i) => i + 1
  );

  return (
    <div className="flex flex-col h-[calc(100vh-3.5rem)]">
      {/* Header */}
      <div className="border-b border-gray-200 bg-white px-4 py-3">
        <div className="mx-auto flex max-w-4xl items-center justify-between">
          <div>
            <h1 className="text-lg font-bold text-gray-900">
              {tournament.name}
            </h1>
            <p className="text-xs text-gray-500">
              {players.length}/{tournament.max_players} players &middot;{" "}
              {tournament.total_rounds} rounds
            </p>
          </div>
          <button
            onClick={copyShareLink}
            className="flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-medium text-blue-600 hover:bg-blue-50 transition-colors"
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
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto pb-20">
        {activeTab === "players" && (
          <PlayersTab
            players={players}
            isFull={isFull}
            maxPlayers={tournament.max_players}
            onDelete={handleDeletePlayer}
          />
        )}

        {activeTab === "matchups" && (
          <MatchupsTab
            tournament={tournament}
            rounds={rounds}
            matchupData={matchupData}
            canGenerate={canGenerate}
            generating={generating}
            genError={genError}
            onGenerate={handleGenerateAllRounds}
            tournamentId={tournamentId}
          />
        )}

        {activeTab === "rankings" && (
          <RankingsTab
            rankings={rankings}
            roundColumns={roundColumns}
          />
        )}
      </div>

      {/* FAB - Add Player */}
      {activeTab === "players" && !isFull && (
        <button
          onClick={() => setShowAddPlayer(true)}
          className="fixed bottom-24 right-6 z-30 flex h-14 w-14 items-center justify-center rounded-full bg-blue-600 text-white shadow-lg hover:bg-blue-700 transition-colors cursor-pointer"
        >
          <UserPlus className="h-6 w-6" />
        </button>
      )}

      {/* Add Player Modal */}
      {showAddPlayer && (
        <div className="fixed inset-0 z-40 flex items-end sm:items-center justify-center bg-black/40">
          <div className="w-full max-w-md rounded-t-2xl sm:rounded-2xl bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-gray-900">Add Player</h2>
              <button
                onClick={() => {
                  setShowAddPlayer(false);
                  setAddError("");
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={handleAddPlayer} className="space-y-3">
              <Input
                id="playerName"
                label="Name"
                placeholder="Player name"
                value={playerName}
                onChange={(e) => setPlayerName(e.target.value)}
                required
              />
              <div className="grid grid-cols-2 gap-3">
                <Select
                  id="gender"
                  label="Gender"
                  value={playerGender}
                  onChange={(e) => setPlayerGender(e.target.value as Gender)}
                  options={[
                    { value: "male", label: "Male" },
                    { value: "female", label: "Female" },
                  ]}
                />
                <Select
                  id="classification"
                  label="Classification"
                  value={playerClassification}
                  onChange={(e) =>
                    setPlayerClassification(e.target.value as Classification)
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
              {addError && (
                <p className="text-sm text-red-600">{addError}</p>
              )}
              <Button
                type="submit"
                className="w-full"
                disabled={addLoading}
              >
                {addLoading ? "Adding..." : "Add Player"}
              </Button>
            </form>
          </div>
        </div>
      )}

      {/* Bottom Nav */}
      <nav className="fixed bottom-0 left-0 right-0 z-20 border-t border-gray-200 bg-white">
        <div className="mx-auto flex max-w-md">
          <TabButton
            active={activeTab === "players"}
            onClick={() => setActiveTab("players")}
            icon={<ClipboardList className="h-5 w-5" />}
            label="Players"
          />
          <TabButton
            active={activeTab === "matchups"}
            onClick={() => setActiveTab("matchups")}
            icon={<Swords className="h-5 w-5" />}
            label="Matchups"
          />
          <TabButton
            active={activeTab === "rankings"}
            onClick={() => setActiveTab("rankings")}
            icon={<BarChart3 className="h-5 w-5" />}
            label="Rankings"
          />
        </div>
      </nav>
    </div>
  );
}

/* ─── Tab Button ─── */
function TabButton({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex flex-1 flex-col items-center gap-0.5 py-2.5 text-xs font-medium transition-colors cursor-pointer ${
        active ? "text-blue-600" : "text-gray-400 hover:text-gray-600"
      }`}
    >
      {icon}
      {label}
    </button>
  );
}

/* ─── Players Tab ─── */
function PlayersTab({
  players,
  isFull,
  maxPlayers,
  onDelete,
}: {
  players: Player[];
  isFull: boolean;
  maxPlayers: number;
  onDelete: (id: string) => void;
}) {
  if (players.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-gray-400">
        <ClipboardList className="h-10 w-10 mb-2" />
        <p className="text-sm">No players registered yet</p>
      </div>
    );
  }

  return (
    <div>
      {isFull && (
        <div className="mx-4 mt-4 rounded-lg bg-green-50 border border-green-200 p-3 text-sm text-green-700">
          All {maxPlayers} player slots filled. Go to Matchups to generate draws!
        </div>
      )}

      {/* Table Header */}
      <div className="grid grid-cols-[3rem_1fr_6rem_5rem_2rem] items-center border-b border-gray-200 px-4 py-2 text-xs font-medium uppercase tracking-wider text-gray-400">
        <span>No.</span>
        <span>Name</span>
        <span>Class</span>
        <span>Gender</span>
        <span></span>
      </div>

      {/* Table Rows */}
      {players.map((player, index) => (
        <div
          key={player.id}
          className="grid grid-cols-[3rem_1fr_6rem_5rem_2rem] items-center border-b border-gray-100 px-4 py-4"
        >
          <span className="text-sm text-gray-400">{index + 1}</span>
          <span className="text-sm font-semibold text-gray-900 uppercase">
            {player.name}
          </span>
          <span className="text-sm font-medium text-gray-700">
            {player.classification}
          </span>
          <span className="text-sm font-bold text-gray-900 uppercase">
            {player.gender}
          </span>
          <button
            onClick={() => onDelete(player.id)}
            className="text-gray-300 hover:text-red-500 transition-colors"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      ))}
    </div>
  );
}

/* ─── Matchups Tab ─── */
function MatchupsTab({
  tournament,
  rounds,
  matchupData,
  canGenerate,
  generating,
  genError,
  onGenerate,
  tournamentId,
}: {
  tournament: Tournament;
  rounds: Round[];
  matchupData: {
    round: Round;
    matches: (Match & { team1Players: Player[]; team2Players: Player[] })[];
  }[];
  canGenerate: boolean;
  generating: boolean;
  genError: string;
  onGenerate: () => void;
  tournamentId: string;
}) {
  const [activeRound, setActiveRound] = useState(1);

  const roundTabs = Array.from(
    { length: tournament.total_rounds },
    (_, i) => i + 1
  );

  const currentRoundData = matchupData.find(
    (d) => d.round.round_number === activeRound
  );

  // No rounds generated yet — show generate button
  if (rounds.length === 0) {
    return (
      <div className="px-4 py-4">
        {canGenerate ? (
          <div className="flex flex-col items-center justify-center py-16">
            <Swords className="h-10 w-10 mb-3 text-gray-300" />
            <p className="mb-4 text-sm text-gray-500">
              Generate all {tournament.total_rounds} rounds at once
            </p>
            <Button onClick={onGenerate} disabled={generating}>
              <Shuffle className="mr-2 h-4 w-4" />
              {generating ? "Generating..." : "Generate All Rounds"}
            </Button>
            {genError && (
              <p className="mt-3 text-sm text-red-600">{genError}</p>
            )}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-20 text-gray-400">
            <Swords className="h-10 w-10 mb-2" />
            <p className="text-sm">
              Fill all {tournament.max_players} player slots first
            </p>
          </div>
        )}
      </div>
    );
  }

  return (
    <div>
      {/* Round Tabs */}
      <div className="flex border-b border-gray-200 bg-white overflow-x-auto">
        {roundTabs.map((r) => (
          <button
            key={r}
            onClick={() => setActiveRound(r)}
            className={`flex-1 min-w-[5rem] py-3 text-center text-xs font-bold uppercase tracking-wide transition-colors cursor-pointer ${
              activeRound === r
                ? "text-blue-600 border-b-3 border-blue-600"
                : "text-gray-400 hover:text-gray-600"
            }`}
          >
            Round {r}
          </button>
        ))}
      </div>

      {/* Match Cards */}
      <div className="p-4">
        {currentRoundData && (
          <div className="flex items-center justify-between mb-3">
            <span
              className={`text-xs font-semibold uppercase ${
                currentRoundData.round.status === "completed"
                  ? "text-green-600"
                  : "text-gray-400"
              }`}
            >
              {currentRoundData.round.status.replace("_", " ")}
            </span>
            <Link
              href={`/tournaments/${tournamentId}/rounds/${activeRound}`}
              className="text-xs text-blue-600 hover:text-blue-700 font-medium"
            >
              Enter Scores &rarr;
            </Link>
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          {currentRoundData?.matches.map((match) => (
            <div
              key={match.id}
              className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm"
            >
              {/* Card Header */}
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-semibold uppercase text-gray-400 tracking-wide">
                  Court {match.court_number}
                </span>
                <span
                  className={`text-xs font-semibold uppercase ${
                    match.status === "completed"
                      ? "text-green-500"
                      : "text-gray-400"
                  }`}
                >
                  {match.status === "completed" ? "Completed" : "Pending"}
                </span>
              </div>

              {/* Team 1 */}
              <div className="flex items-center gap-2 mb-2">
                <span
                  className={`flex h-7 w-7 items-center justify-center rounded-md text-xs font-bold text-white ${
                    match.status === "completed" &&
                    match.team1_score > match.team2_score
                      ? "bg-green-500"
                      : match.status === "completed"
                        ? "bg-blue-400"
                        : "bg-gray-300"
                  }`}
                >
                  {match.status === "completed" ? match.team1_score : "-"}
                </span>
                <div className="flex items-center gap-1 text-sm">
                  {match.team1Players.map((p, i) => (
                    <span key={p.id} className="flex items-center gap-1">
                      {i > 0 && (
                        <span className="text-gray-400">/</span>
                      )}
                      <span className="font-semibold text-gray-900 uppercase">
                        {p.name}
                      </span>
                      <span className="font-bold text-gray-500 text-xs">
                        {p.classification}
                      </span>
                    </span>
                  ))}
                </div>
              </div>

              {/* Team 2 */}
              <div className="flex items-center gap-2">
                <span
                  className={`flex h-7 w-7 items-center justify-center rounded-md text-xs font-bold text-white ${
                    match.status === "completed" &&
                    match.team2_score > match.team1_score
                      ? "bg-green-500"
                      : match.status === "completed"
                        ? "bg-blue-400"
                        : "bg-gray-300"
                  }`}
                >
                  {match.status === "completed" ? match.team2_score : "-"}
                </span>
                <div className="flex items-center gap-1 text-sm">
                  {match.team2Players.map((p, i) => (
                    <span key={p.id} className="flex items-center gap-1">
                      {i > 0 && (
                        <span className="text-gray-400">/</span>
                      )}
                      <span className="font-semibold text-gray-900 uppercase">
                        {p.name}
                      </span>
                      <span className="font-bold text-gray-500 text-xs">
                        {p.classification}
                      </span>
                    </span>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>

        {!currentRoundData && (
          <div className="flex flex-col items-center justify-center py-16 text-gray-400">
            <p className="text-sm">No matches for this round yet</p>
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── Rankings Tab ─── */
function RankingsTab({
  rankings,
  roundColumns,
}: {
  rankings: {
    player: Player;
    roundScores: Record<number, number>;
    total: number;
  }[];
  roundColumns: number[];
}) {
  if (rankings.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-gray-400">
        <BarChart3 className="h-10 w-10 mb-2" />
        <p className="text-sm">No rankings yet</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-gray-200 text-xs uppercase tracking-wider text-gray-400">
            <th className="px-4 py-3 font-medium">#</th>
            <th className="px-4 py-3 font-medium">Player</th>
            <th className="px-4 py-3 font-medium">Class</th>
            {roundColumns.map((r) => (
              <th key={r} className="px-3 py-3 text-center font-medium">
                R{r}
              </th>
            ))}
            <th className="px-4 py-3 text-center font-medium">Total</th>
          </tr>
        </thead>
        <tbody>
          {rankings.map((row, index) => (
            <tr
              key={row.player.id}
              className={`border-b border-gray-100 ${
                index < 3 ? "bg-yellow-50/60" : ""
              }`}
            >
              <td className="px-4 py-3 text-gray-400 font-medium">
                {index + 1}
              </td>
              <td className="px-4 py-3 font-semibold text-gray-900 uppercase">
                {row.player.name}
              </td>
              <td className="px-4 py-3 font-medium text-gray-700">
                {row.player.classification}
              </td>
              {roundColumns.map((r) => (
                <td key={r} className="px-3 py-3 text-center text-gray-600">
                  {row.roundScores[r] !== undefined
                    ? row.roundScores[r]
                    : "—"}
                </td>
              ))}
              <td className="px-4 py-3 text-center font-bold text-gray-900">
                {row.total}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
