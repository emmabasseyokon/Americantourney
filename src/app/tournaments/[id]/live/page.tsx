"use client";

import { createClient } from "@/lib/supabase/client";
import { SkeletonList } from "@/components/ui/Skeleton";
import type { Tournament, Player, Round, Match } from "@/types/database";
import {
  ClipboardList,
  Swords,
  BarChart3,
  Trophy,
} from "lucide-react";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";

type Tab = "players" | "matchups" | "rankings";

export default function LiveTournamentPage() {
  const supabase = createClient();
  const params = useParams();
  const tournamentId = params.id as string;

  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [rounds, setRounds] = useState<Round[]>([]);
  const [activeTab, setActiveTab] = useState<Tab>("players");
  const [loading, setLoading] = useState(true);

  // Matchups state
  const [matchupData, setMatchupData] = useState<
    {
      round: Round;
      matches: (Match & { team1Players: Player[]; team2Players: Player[] })[];
    }[]
  >([]);

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

  const roundColumns = Array.from(
    { length: tournament.total_rounds },
    (_, i) => i + 1
  );

  return (
    <div className="flex flex-col h-[calc(100vh-3.5rem)] bg-white">
      {/* Header */}
      <div className="border-b border-gray-200 bg-white px-4 py-3">
        <div className="mx-auto max-w-4xl">
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
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto pb-20">
        {activeTab === "players" && (
          <LivePlayersTab players={players} />
        )}

        {activeTab === "matchups" && (
          <LiveMatchupsTab
            tournament={tournament}
            rounds={rounds}
            matchupData={matchupData}
          />
        )}

        {activeTab === "rankings" && (
          <LiveRankingsTab rankings={rankings} roundColumns={roundColumns} />
        )}
      </div>

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

/* ─── Players Tab (no classification, no edit/delete) ─── */
function LivePlayersTab({ players }: { players: Player[] }) {
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
      <div className="grid grid-cols-[2.5rem_1fr_5rem] sm:grid-cols-[3fr_3fr_1fr] items-center border-b border-gray-200 px-4 py-2 text-xs font-medium uppercase tracking-wider text-gray-400">
        <span>No.</span>
        <span>Name</span>
        <span>Gender</span>
      </div>

      {/* Table Rows */}
      {players.map((player, index) => (
        <div
          key={player.id}
          className="grid grid-cols-[2.5rem_1fr_5rem] sm:grid-cols-[3fr_3fr_1fr] items-center border-b border-gray-100 px-4 py-4"
        >
          <span className="text-sm text-gray-400">{index + 1}</span>
          <span className="text-sm font-semibold text-gray-900 uppercase">
            {player.name}
          </span>
          <span className="text-sm font-bold text-gray-900 uppercase">
            {player.gender}
          </span>
        </div>
      ))}
    </div>
  );
}

/* ─── Status helpers ─── */
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
function LiveMatchupsTab({
  tournament,
  rounds,
  matchupData,
}: {
  tournament: Tournament;
  rounds: Round[];
  matchupData: {
    round: Round;
    matches: (Match & { team1Players: Player[]; team2Players: Player[] })[];
  }[];
}) {
  const [activeRound, setActiveRound] = useState(1);

  const roundTabs = Array.from(
    { length: tournament.total_rounds },
    (_, i) => i + 1
  );

  const currentRoundData = matchupData.find(
    (d) => d.round.round_number === activeRound
  );

  // Build map: player ID → court tag for players in_progress — only show on FUTURE rounds
  const playerActiveCourt = new Map<string, string>();
  for (const rd of matchupData) {
    if (rd.round.round_number >= activeRound) continue;
    for (const m of rd.matches) {
      if (m.status !== "in_progress" || m.court_number === 0) continue;
      const courtTag = m.court_number === 8 ? "CC" : `C${m.court_number}`;
      for (const p of [...m.team1Players, ...m.team2Players]) {
        playerActiveCourt.set(p.id, courtTag);
      }
    }
  }

  // Players whose previous-round match is NOT completed
  const playerNotReady = new Set<string>();
  for (const rd of matchupData) {
    if (rd.round.round_number >= activeRound) continue;
    for (const m of rd.matches) {
      if (m.status === "completed") continue;
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

  if (rounds.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-gray-400">
        <Swords className="h-10 w-10 mb-2" />
        <p className="text-sm">No rounds generated yet</p>
        <p className="text-xs mt-1">Check back soon!</p>
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
              className="rounded-xl border border-gray-100 bg-white p-4 shadow-md"
            >
              {/* Card Header — status left, court right */}
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
    </div>
  );
}

function ordinal(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

/* ─── Rankings Tab (no classification) ─── */
function LiveRankingsTab({
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
