"use client";

import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { useSupabase } from "@/components/providers/SupabaseProvider";
import { generateRoundDraw } from "@/lib/draw/americano";
import type { RoundDraw } from "@/lib/draw/types";
import type {
  Tournament,
  Player,
  Round,
  Match,
  Classification,
  Gender,
} from "@/types/database";
import { SkeletonList } from "@/components/ui/Skeleton";
import {
  ClipboardList,
  Swords,
  BarChart3,
  UserPlus,
  Share2,
  Copy,
  Shuffle,
  X,
  MoreVertical,
} from "lucide-react";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

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

  // Add/edit player state
  const [showAddPlayer, setShowAddPlayer] = useState(false);
  const [editingPlayer, setEditingPlayer] = useState<Player | null>(null);
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
  const [previewDraws, setPreviewDraws] = useState<RoundDraw[] | null>(null);

  // Rankings state
  const [rankings, setRankings] = useState<
    { player: Player; roundScores: Record<number, number>; total: number }[]
  >([]);

  const fetchData = useCallback(async function fetchData() {
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
  }, [supabase, tournamentId]);

  const fetchMatchups = useCallback(async function fetchMatchups() {
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
  }, [supabase, rounds, players]);

  const fetchRankings = useCallback(async function fetchRankings() {
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
  }, [supabase, rounds, players]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    if (activeTab === "matchups" && rounds.length > 0) {
      fetchMatchups();
    }
    if (activeTab === "rankings") {
      fetchRankings();
    }
  }, [activeTab, rounds, fetchMatchups, fetchRankings]);

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

  function handleEditPlayer(player: Player) {
    setEditingPlayer(player);
    setPlayerName(player.name);
    setPlayerGender(player.gender);
    setPlayerClassification(player.classification);
    setShowAddPlayer(true);
  }

  async function handleSaveEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editingPlayer) return;
    setAddError("");
    setAddLoading(true);

    const { error: dbError } = await supabase
      .from("players")
      .update({
        name: playerName.trim(),
        gender: playerGender,
        classification: playerClassification,
      })
      .eq("id", editingPlayer.id);

    if (dbError) {
      setAddError(dbError.message);
      setAddLoading(false);
      return;
    }

    setPlayers(
      players.map((p) =>
        p.id === editingPlayer.id
          ? { ...p, name: playerName.trim(), gender: playerGender, classification: playerClassification }
          : p
      )
    );
    setEditingPlayer(null);
    setPlayerName("");
    setShowAddPlayer(false);
    setAddLoading(false);
  }

  async function handleDeletePlayer(playerId: string) {
    await supabase.from("players").delete().eq("id", playerId);
    setPlayers(players.filter((p) => p.id !== playerId));
  }

  function handleGeneratePreview() {
    if (!tournament) return;
    setGenError("");

    if (players.length < tournament.max_players) {
      setGenError(
        `Need ${tournament.max_players} players. Currently have ${players.length}.`
      );
      return;
    }

    try {
      const pairingHistory = new Set<string>();
      const draws: RoundDraw[] = [];

      for (let roundNum = 1; roundNum <= tournament.total_rounds; roundNum++) {
        const draw = generateRoundDraw(players, roundNum, pairingHistory);

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

        draws.push(draw);
      }

      setPreviewDraws(draws);
    } catch (err) {
      setGenError(
        err instanceof Error ? err.message : "Failed to generate draws."
      );
    }
  }

  async function handleLockDraws() {
    if (!tournament || !previewDraws) return;
    setGenerating(true);
    setGenError("");

    try {
      for (const draw of previewDraws) {
        const { data: round, error: roundErr } = await supabase
          .from("rounds")
          .insert({
            tournament_id: tournamentId,
            round_number: draw.roundNumber,
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
              court_number: 0,
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

      setPreviewDraws(null);
      await fetchData();
    } catch (err) {
      setGenError(
        err instanceof Error ? err.message : "Failed to save draws."
      );
    } finally {
      setGenerating(false);
    }
  }

  async function handleUpdateMatch(matchId: string, updates: Partial<Match>) {
    await supabase.from("matches").update(updates).eq("id", matchId);

    // Update local matchup data
    setMatchupData((prev) =>
      prev.map((rd) => ({
        ...rd,
        matches: rd.matches.map((m) =>
          m.id === matchId ? { ...m, ...updates } : m
        ),
      }))
    );

    // Check if all matches in the round are completed
    if (updates.status === "completed") {
      for (const rd of matchupData) {
        const allDone = rd.matches.every((m) =>
          m.id === matchId ? true : m.status === "completed"
        );
        if (allDone) {
          await supabase
            .from("rounds")
            .update({ status: "completed" })
            .eq("id", rd.round.id);
        }
      }
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
      <div className="flex flex-col h-[calc(100vh-3.5rem)] bg-white">
        <div className="border-b border-gray-200 bg-white px-4 py-3">
          <div className="h-5 w-40 animate-pulse rounded bg-gray-100" />
          <div className="mt-1 h-3 w-28 animate-pulse rounded bg-gray-100" />
        </div>
        <SkeletonList rows={6} />
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
    <div className="flex flex-col h-[calc(100vh-3.5rem)] bg-white">
      {/* Header */}
      <div className="border-b border-gray-200 bg-white px-4 py-3">
        <div className="mx-auto flex max-w-4xl items-center justify-between">
          <div>
            <h1 className="text-lg font-bold text-gray-900">
              {tournament.name}
            </h1>
            <p className="text-xs text-gray-500">
              {players.length} Registered{" "}
              {tournament.max_players - players.length > 0
                ? `${tournament.max_players - players.length} Remaining`
                : ""}{" "}
              | {tournament.total_rounds} Rounds
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
            onEdit={handleEditPlayer}
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
            previewDraws={previewDraws}
            players={players}
            onGeneratePreview={handleGeneratePreview}
            onLockDraws={handleLockDraws}
            onCancelPreview={() => setPreviewDraws(null)}
            onUpdateMatch={handleUpdateMatch}
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

      {/* Add/Edit Player Modal */}
      {showAddPlayer && (
        <div className="fixed inset-0 z-40 flex items-end sm:items-center justify-center bg-black/40">
          <div className="w-full max-w-md rounded-t-2xl sm:rounded-2xl bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-gray-900">
                {editingPlayer ? "Edit Player" : "Add Player"}
              </h2>
              <button
                onClick={() => {
                  setShowAddPlayer(false);
                  setEditingPlayer(null);
                  setPlayerName("");
                  setAddError("");
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <form
              onSubmit={editingPlayer ? handleSaveEdit : handleAddPlayer}
              className="space-y-3"
            >
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
                {addLoading
                  ? editingPlayer
                    ? "Saving..."
                    : "Adding..."
                  : editingPlayer
                    ? "Save Changes"
                    : "Add Player"}
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
  onEdit,
  onDelete,
}: {
  players: Player[];
  onEdit: (player: Player) => void;
  onDelete: (id: string) => void;
}) {
  const [menuOpen, setMenuOpen] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Player | null>(null);

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

      {/* Table Header */}
      <div className="grid grid-cols-[2.5rem_1fr_4rem_5rem_2rem] sm:grid-cols-[3rem_2fr_1fr_1fr_2.5rem] items-center border-b border-gray-200 px-4 py-2 text-xs font-medium uppercase tracking-wider text-gray-400">
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
          className="grid grid-cols-[2.5rem_1fr_4rem_5rem_2rem] sm:grid-cols-[3rem_2fr_1fr_1fr_2.5rem] items-center border-b border-gray-100 px-4 py-4"
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
          <div className="relative">
            <button
              onClick={() =>
                setMenuOpen(menuOpen === player.id ? null : player.id)
              }
              className="p-1 text-gray-400 hover:text-gray-600 transition-colors cursor-pointer"
            >
              <MoreVertical className="h-4 w-4" />
            </button>

            {menuOpen === player.id && (
              <>
                <div
                  className="fixed inset-0 z-30"
                  onClick={() => setMenuOpen(null)}
                />
                <div className="absolute right-0 top-8 z-40 w-32 rounded-lg border border-gray-200 bg-white py-1 shadow-lg">
                  <button
                    onClick={() => {
                      onEdit(player);
                      setMenuOpen(null);
                    }}
                    className="flex w-full items-center px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 cursor-pointer"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => {
                      setConfirmDelete(player);
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

      {/* Delete Confirmation Modal */}
      {confirmDelete && (
        <div className="fixed inset-0 z-40 flex items-end sm:items-center justify-center bg-black/40">
          <div className="w-full max-w-sm rounded-t-2xl sm:rounded-lg bg-white p-6 shadow-xl">
            <h2 className="text-lg font-bold text-gray-900">Delete player?</h2>
            <p className="mt-2 text-sm text-gray-500">
              Are you sure you want to delete <strong>{confirmDelete.name}</strong>? This action cannot be undone.
            </p>
            <div className="mt-5 flex gap-3 justify-end">
              <button
                onClick={() => setConfirmDelete(null)}
                className="rounded-lg px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  onDelete(confirmDelete.id);
                  setConfirmDelete(null);
                }}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 transition-colors cursor-pointer"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── Court options ─── */
const COURT_OPTIONS = [
  { value: 1, label: "Court 1" },
  { value: 2, label: "Court 2" },
  { value: 3, label: "Court 3" },
  { value: 4, label: "Court 4" },
  { value: 5, label: "Court 5" },
  { value: 6, label: "Court 6" },
  { value: 7, label: "Court 7" },
  { value: 8, label: "Centre Court" },
];

function getCourtLabel(match: Match): string {
  if (match.court_name) return match.court_name;
  if (match.court_number > 0 && match.court_number <= 7) return `Court ${match.court_number}`;
  if (match.court_number === 8) return "Centre Court";
  return "";
}

function getStatusLabel(status: string): string {
  if (status === "pending") return "Ready";
  if (status === "in_progress") return "In Progress";
  return "Completed";
}

function getStatusColor(status: string): string {
  if (status === "pending") return "text-blue-500";
  if (status === "in_progress") return "text-orange-500";
  return "text-green-500";
}

/* ─── Matchups Tab ─── */
function MatchupsTab({
  tournament,
  rounds,
  matchupData,
  canGenerate,
  generating,
  genError,
  previewDraws,
  players,
  onGeneratePreview,
  onLockDraws,
  onCancelPreview,
  onUpdateMatch,
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
  previewDraws: RoundDraw[] | null;
  players: Player[];
  onGeneratePreview: () => void;
  onLockDraws: () => void;
  onCancelPreview: () => void;
  onUpdateMatch: (matchId: string, updates: Partial<Match>) => Promise<void>;
}) {
  const [activeRound, setActiveRound] = useState(1);
  const [menuOpen, setMenuOpen] = useState<string | null>(null);
  const [courtPickerMatch, setCourtPickerMatch] = useState<string | null>(null);
  const [scoreModal, setScoreModal] = useState<
    (Match & { team1Players: Player[]; team2Players: Player[] }) | null
  >(null);
  const [team1Input, setTeam1Input] = useState("");
  const [team2Input, setTeam2Input] = useState("");
  const [saving, setSaving] = useState(false);

  const team1Score = team1Input === "" ? null : Math.min(5, Math.max(0, parseInt(team1Input) || 0));

  const roundTabs = Array.from(
    { length: tournament.total_rounds },
    (_, i) => i + 1
  );

  const currentRoundData = matchupData.find(
    (d) => d.round.round_number === activeRound
  );

  // Get courts already in use for this round (to show which are taken)
  const usedCourts = new Set(
    (currentRoundData?.matches ?? [])
      .filter((m) => m.court_number > 0 && m.status === "in_progress")
      .map((m) => m.court_number)
  );

  // Build map: player ID → court label for players in_progress — only show on FUTURE rounds
  const playerActiveCourt = new Map<string, string>();
  for (const rd of matchupData) {
    if (rd.round.round_number >= activeRound) continue;
    for (const m of rd.matches) {
      if (m.status !== "in_progress" || m.court_number === 0) continue;
      const courtTag =
        m.court_number === 8
          ? "CC"
          : `C${m.court_number}`;
      for (const p of [...m.team1Players, ...m.team2Players]) {
        playerActiveCourt.set(p.id, courtTag);
      }
    }
  }

  // Build set of player IDs whose previous-round match is in progress (actively on court)
  const playerNotReady = new Set<string>();
  for (const rd of matchupData) {
    if (rd.round.round_number >= activeRound) continue;
    for (const m of rd.matches) {
      if (m.status !== "in_progress") continue;
      for (const p of [...m.team1Players, ...m.team2Players]) {
        playerNotReady.add(p.id);
      }
    }
  }

  function isMatchNotReady(
    match: Match & { team1Players: Player[]; team2Players: Player[] }
  ): boolean {
    if (match.status !== "pending") return false;
    return [...match.team1Players, ...match.team2Players].some((p) =>
      playerNotReady.has(p.id)
    );
  }

  async function handleStartMatch(matchId: string, courtValue: number) {
    const courtLabel = COURT_OPTIONS.find((c) => c.value === courtValue)?.label ?? null;
    await onUpdateMatch(matchId, {
      court_number: courtValue,
      court_name: courtLabel,
      status: "in_progress",
    });
    setCourtPickerMatch(null);
    setMenuOpen(null);
  }

  async function handleClearCourt(matchId: string) {
    await onUpdateMatch(matchId, {
      court_number: 0,
      court_name: null,
      status: "pending",
    });
    setMenuOpen(null);
  }

  async function handleRecordScores() {
    if (!scoreModal || team1Score === null) return;
    setSaving(true);
    const finalTeam2 = 5 - team1Score;
    await onUpdateMatch(scoreModal.id, {
      team1_score: team1Score,
      team2_score: finalTeam2,
      status: "completed",
    });
    setSaving(false);
    setScoreModal(null);
    setMenuOpen(null);
  }

  // Build player map for preview rendering
  const playerMap = new Map(players.map((p) => [p.id, p]));

  // Preview mode: show generated draws before locking
  if (previewDraws && rounds.length === 0) {
    const previewRound = previewDraws.find((d) => d.roundNumber === activeRound);

    // Detect repeat pairings across all preview rounds
    const repeatPairings: { round: number; player1: string; player2: string }[] = [];
    const seenPairs = new Map<string, number>(); // pairKey → first round number
    for (const draw of previewDraws) {
      for (const matchDraw of draw.matches) {
        const pairs = [
          { p1: matchDraw.team1.player1, p2: matchDraw.team1.player2 },
          { p1: matchDraw.team2.player1, p2: matchDraw.team2.player2 },
        ];
        for (const { p1, p2 } of pairs) {
          const key = [p1.id, p2.id].sort().join(":");
          const firstRound = seenPairs.get(key);
          if (firstRound !== undefined) {
            const name1 = playerMap.get(p1.id)?.name ?? p1.name;
            const name2 = playerMap.get(p2.id)?.name ?? p2.name;
            repeatPairings.push({ round: draw.roundNumber, player1: name1, player2: name2 });
          } else {
            seenPairs.set(key, draw.roundNumber);
          }
        }
      }
    }

    return (
      <div>
        {/* Preview banner */}
        <div className="mx-4 mt-4 rounded-lg bg-amber-50 border border-amber-200 p-3 text-sm text-amber-700">
          Preview — regenerate if unhappy, or lock to confirm draws.
        </div>

        {/* Repeat pairings alert */}
        {repeatPairings.length > 0 && (
          <div className="mx-4 mt-3 rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700">
            <p className="font-semibold mb-1">
              {repeatPairings.length} repeat pairing{repeatPairings.length > 1 ? "s" : ""} detected:
            </p>
            <ul className="list-disc pl-4 space-y-0.5">
              {repeatPairings.map((rp, i) => (
                <li key={i}>
                  <span className="font-medium uppercase">{rp.player1}</span>
                  {" & "}
                  <span className="font-medium uppercase">{rp.player2}</span>
                  {" — Round "}
                  {rp.round}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Round Tabs */}
        <div className="flex border-b border-gray-200 bg-white overflow-x-auto mt-3">
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

        {/* Preview match cards */}
        <div className="p-4">
          <div className="grid gap-4 sm:grid-cols-2">
            {previewRound?.matches.map((matchDraw, idx) => (
              <div
                key={idx}
                className="rounded-xl border border-dashed border-amber-300 bg-white p-4 shadow-sm"
              >
                <div className="mb-3">
                  <span className="text-xs font-semibold uppercase tracking-wide text-amber-500">
                    Preview
                  </span>
                </div>

                {/* Team 1 */}
                <div className="flex items-center gap-2 mb-2">
                  <span className="flex h-7 w-7 items-center justify-center rounded-md bg-gray-300 text-xs font-bold text-white">
                    -
                  </span>
                  <div className="flex items-center gap-1 text-sm">
                    <span className="font-semibold text-gray-900 uppercase">
                      {playerMap.get(matchDraw.team1.player1.id)?.name ?? matchDraw.team1.player1.name}
                    </span>
                    <span className="text-xs font-medium text-gray-500">
                      ({matchDraw.team1.player1.classification})
                    </span>
                    <span className="text-gray-400">/</span>
                    <span className="font-semibold text-gray-900 uppercase">
                      {playerMap.get(matchDraw.team1.player2.id)?.name ?? matchDraw.team1.player2.name}
                    </span>
                    <span className="text-xs font-medium text-gray-500">
                      ({matchDraw.team1.player2.classification})
                    </span>
                  </div>
                </div>

                {/* Team 2 */}
                <div className="flex items-center gap-2">
                  <span className="flex h-7 w-7 items-center justify-center rounded-md bg-gray-300 text-xs font-bold text-white">
                    -
                  </span>
                  <div className="flex items-center gap-1 text-sm">
                    <span className="font-semibold text-gray-900 uppercase">
                      {playerMap.get(matchDraw.team2.player1.id)?.name ?? matchDraw.team2.player1.name}
                    </span>
                    <span className="text-xs font-medium text-gray-500">
                      ({matchDraw.team2.player1.classification})
                    </span>
                    <span className="text-gray-400">/</span>
                    <span className="font-semibold text-gray-900 uppercase">
                      {playerMap.get(matchDraw.team2.player2.id)?.name ?? matchDraw.team2.player2.name}
                    </span>
                    <span className="text-xs font-medium text-gray-500">
                      ({matchDraw.team2.player2.classification})
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Preview action buttons */}
        <div className="flex gap-3 px-4 pb-4">
          <button
            onClick={onCancelPreview}
            className="flex-1 rounded-lg border border-gray-300 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            onClick={onGeneratePreview}
            className="flex-1 rounded-lg border border-blue-300 bg-blue-50 py-2.5 text-sm font-medium text-blue-600 hover:bg-blue-100 transition-colors cursor-pointer"
          >
            <Shuffle className="mr-1.5 h-4 w-4 inline" />
            Regenerate
          </button>
          <button
            onClick={onLockDraws}
            disabled={generating}
            className="flex-1 rounded-lg bg-green-600 py-2.5 text-sm font-medium text-white hover:bg-green-700 transition-colors disabled:opacity-50 cursor-pointer"
          >
            {generating ? "Locking..." : "Lock Draws"}
          </button>
        </div>

        {genError && (
          <p className="px-4 pb-4 text-sm text-red-600">{genError}</p>
        )}
      </div>
    );
  }

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
            <Button onClick={onGeneratePreview}>
              <Shuffle className="mr-2 h-4 w-4" />
              Generate All Rounds
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
        <div className="grid gap-4 sm:grid-cols-2">
          {currentRoundData?.matches.map((match) => (
            <div
              key={match.id}
              className="relative rounded-xl border border-gray-100 bg-white p-4 shadow-md"
            >
              {/* Card Header — status left, court center-ish, 3-dot right */}
              <div className="flex items-center justify-between mb-3">
                <span
                  className={`text-xs font-semibold uppercase tracking-wide ${
                    isMatchNotReady(match)
                      ? "text-red-500"
                      : getStatusColor(match.status)
                  }`}
                >
                  {isMatchNotReady(match)
                    ? "Not Ready"
                    : getStatusLabel(match.status)}
                </span>
                {match.court_number > 0 && (
                  <span className="text-xs font-medium text-gray-500">
                    {getCourtLabel(match)}
                  </span>
                )}
                <div className="relative">
                  <button
                    onClick={() =>
                      setMenuOpen(menuOpen === match.id ? null : match.id)
                    }
                    className="p-1 text-gray-400 hover:text-gray-600 transition-colors cursor-pointer"
                  >
                    <MoreVertical className="h-4 w-4" />
                  </button>

                  {/* Kebab Menu */}
                  {menuOpen === match.id && (
                    <>
                      <div
                        className="fixed inset-0 z-30"
                        onClick={() => setMenuOpen(null)}
                      />
                      <div className="absolute right-0 top-8 z-40 w-44 rounded-lg border border-gray-200 bg-white py-1 shadow-lg">
                        {match.status === "pending" && !isMatchNotReady(match) && (
                          <button
                            onClick={() => {
                              setCourtPickerMatch(match.id);
                              setMenuOpen(null);
                            }}
                            className="flex w-full items-center gap-2 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 cursor-pointer"
                          >
                            Start Match
                          </button>
                        )}
                        {match.status === "pending" && isMatchNotReady(match) && (
                          <span className="flex w-full items-center gap-2 px-4 py-2.5 text-sm text-gray-300">
                            Start Match
                          </span>
                        )}
                        {match.status === "in_progress" && (
                          <>
                            <button
                              onClick={() => handleClearCourt(match.id)}
                              className="flex w-full items-center gap-2 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 cursor-pointer"
                            >
                              Clear Court
                            </button>
                            <button
                              onClick={() => {
                                setScoreModal(match);
                                setTeam1Input("");
                                setTeam2Input("");
                                setMenuOpen(null);
                              }}
                              className="flex w-full items-center gap-2 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 cursor-pointer"
                            >
                              Record Scores
                            </button>
                          </>
                        )}
                        {match.status === "completed" && (
                          <button
                            onClick={() => {
                              setScoreModal(match);
                              setTeam1Input(String(match.team1_score));
                              setTeam2Input(String(match.team2_score));
                              setMenuOpen(null);
                            }}
                            className="flex w-full items-center gap-2 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 cursor-pointer"
                          >
                            Edit Scores
                          </button>
                        )}
                      </div>
                    </>
                  )}
                </div>
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
                  {match.status === "completed" ? match.team1_score : match.status === "in_progress" ? match.team1_score : "0"}
                </span>
                <div className="flex items-center gap-1 text-sm">
                  {match.team1Players.map((p, i) => (
                    <span key={p.id} className="flex items-center gap-1">
                      {i > 0 && <span className="text-gray-400">/</span>}
                      <span className="font-semibold text-gray-900 uppercase">
                        {p.name}
                      </span>
                      <span className="font-bold text-gray-500 text-xs">
                        {p.classification}
                      </span>
                      {playerActiveCourt.has(p.id) && (
                        <span className="rounded bg-red-500 px-1.5 py-0.5 text-[10px] font-bold text-white leading-none">
                          {playerActiveCourt.get(p.id)}
                        </span>
                      )}
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
                  {match.status === "completed" ? match.team2_score : match.status === "in_progress" ? match.team2_score : "0"}
                </span>
                <div className="flex items-center gap-1 text-sm">
                  {match.team2Players.map((p, i) => (
                    <span key={p.id} className="flex items-center gap-1">
                      {i > 0 && <span className="text-gray-400">/</span>}
                      <span className="font-semibold text-gray-900 uppercase">
                        {p.name}
                      </span>
                      <span className="font-bold text-gray-500 text-xs">
                        {p.classification}
                      </span>
                      {playerActiveCourt.has(p.id) && (
                        <span className="rounded bg-red-500 px-1.5 py-0.5 text-[10px] font-bold text-white leading-none">
                          {playerActiveCourt.get(p.id)}
                        </span>
                      )}
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

      {/* Court Picker Modal */}
      {courtPickerMatch && (
        <div className="fixed inset-0 z-40 flex items-end sm:items-center justify-center bg-black/40">
          <div className="w-full max-w-sm rounded-t-2xl sm:rounded-2xl bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-gray-200 px-5 py-4">
              <h2 className="text-base font-bold text-gray-900">
                Select venue for match
              </h2>
              <button
                onClick={() => setCourtPickerMatch(null)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="py-2">
              {COURT_OPTIONS.map((court) => {
                const inUse = usedCourts.has(court.value);
                return (
                  <button
                    key={court.value}
                    disabled={inUse}
                    onClick={() =>
                      handleStartMatch(courtPickerMatch, court.value)
                    }
                    className={`flex w-full items-center justify-between px-5 py-3.5 text-sm transition-colors cursor-pointer ${
                      inUse
                        ? "text-gray-300 cursor-not-allowed"
                        : "text-gray-700 hover:bg-gray-50"
                    }`}
                  >
                    <span>{court.label}</span>
                    {inUse && (
                      <span className="text-xs text-gray-300">In use</span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Record Scores Modal */}
      {scoreModal && (
        <div className="fixed inset-0 z-40 flex items-end sm:items-center justify-center bg-black/40">
          <div className="w-full max-w-md rounded-t-2xl sm:rounded-2xl bg-white shadow-xl">
            {/* Blue header */}
            <div className="flex items-center justify-between bg-blue-600 px-5 py-4 rounded-t-2xl">
              <h2 className="text-base font-bold text-white">
                Record scores
              </h2>
              <button
                onClick={() => setScoreModal(null)}
                className="text-white/80 hover:text-white cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-5 space-y-5">
              {/* Team 1 */}
              <div>
                <div className="flex items-center gap-1.5 text-sm mb-3">
                  {scoreModal.team1Players.map((p, i) => (
                    <span key={p.id} className="flex items-center gap-1">
                      {i > 0 && <span className="text-gray-400">/</span>}
                      <span className="font-semibold text-gray-900 uppercase">
                        {p.name}
                      </span>
                    </span>
                  ))}
                </div>
                <div className="flex items-center gap-3 border-b-2 border-green-500 pb-2">
                  <span className="text-sm text-gray-500">Score</span>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={team1Input}
                    onFocus={(e) => e.target.select()}
                    onChange={(e) => {
                      const raw = e.target.value.replace(/[^0-5]/g, "").slice(-1);
                      setTeam1Input(raw);
                      if (raw !== "") {
                        setTeam2Input(String(5 - parseInt(raw)));
                      } else {
                        setTeam2Input("");
                      }
                    }}
                    placeholder="0"
                    className="w-12 bg-transparent text-lg font-bold text-gray-900 outline-none"
                  />
                </div>
              </div>

              {/* Team 2 */}
              <div>
                <div className="flex items-center gap-1.5 text-sm mb-3">
                  {scoreModal.team2Players.map((p, i) => (
                    <span key={p.id} className="flex items-center gap-1">
                      {i > 0 && <span className="text-gray-400">/</span>}
                      <span className="font-semibold text-gray-900 uppercase">
                        {p.name}
                      </span>
                    </span>
                  ))}
                </div>
                <div className="flex items-center gap-3 border-b-2 border-green-500 pb-2">
                  <span className="text-sm text-gray-500">Score</span>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={team2Input}
                    onFocus={(e) => e.target.select()}
                    onChange={(e) => {
                      const raw = e.target.value.replace(/[^0-5]/g, "").slice(-1);
                      setTeam2Input(raw);
                      if (raw !== "") {
                        setTeam1Input(String(5 - parseInt(raw)));
                      } else {
                        setTeam1Input("");
                      }
                    }}
                    placeholder="0"
                    className="w-12 bg-transparent text-lg font-bold text-gray-900 outline-none"
                  />
                </div>
              </div>

              <button
                onClick={handleRecordScores}
                disabled={saving || team1Score === null}
                className="w-full rounded-lg bg-blue-600 py-3.5 text-base font-bold text-white hover:bg-blue-700 transition-colors disabled:opacity-50 cursor-pointer"
              >
                {saving ? "Saving..." : "SAVE"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ordinal(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
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
    <div className="overflow-x-auto bg-white">
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
              <td className="px-4 py-3 text-center font-bold text-gray-900 whitespace-nowrap">
                {row.total} <span className="text-xs font-medium text-gray-400">({ordinal(index + 1)})</span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
