"use client";

import { createClient } from "@/lib/supabase/client";
import { SkeletonList } from "@/components/ui/Skeleton";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { TvModeButton } from "@/components/ui/TvModeButton";
import { useTvMode } from "@/hooks/useTvMode";
import type { Tournament, Player, Round } from "@/types/database";
import {
  fetchAndEnrichMatchups,
  fetchAndCalculateRankings,
  buildPlayerActiveCourts,
  buildPlayerNotReady,
  isMatchNotReady,
  type RoundMatchupData,
  type LeaderboardRow,
} from "@/lib/utils/matchups";
import { ordinal, getCourtLabel, getStatusLabel, getStatusColor } from "@/lib/utils/format";
import {
  ClipboardList,
  Swords,
  BarChart3,
} from "lucide-react";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

type Tab = "players" | "matchups" | "rankings";

export default function LiveTournamentPage() {
  const supabase = useMemo(() => createClient(), []);
  const params = useParams();
  const tournamentId = params.id as string;

  const { isTvMode, controlsVisible, toggleTvMode } = useTvMode();
  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [rounds, setRounds] = useState<Round[]>([]);
  const [activeTab, setActiveTab] = useState<Tab>("players");
  const [loading, setLoading] = useState(true);

  // Matchups state
  const [matchupData, setMatchupData] = useState<RoundMatchupData[]>([]);

  // Rankings state
  const [rankings, setRankings] = useState<LeaderboardRow[]>([]);

  // Initial fetch + Supabase Realtime subscriptions
  useEffect(() => {
    async function fetchCoreData() {
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

    fetchCoreData();

    const channel = supabase
      .channel(`live-${tournamentId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "tournaments", filter: `id=eq.${tournamentId}` },
        () => fetchCoreData()
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "players", filter: `tournament_id=eq.${tournamentId}` },
        () => fetchCoreData()
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "rounds", filter: `tournament_id=eq.${tournamentId}` },
        () => fetchCoreData()
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "matches" },
        () => fetchCoreData()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase, tournamentId]);

  useEffect(() => {
    if (activeTab === "matchups" && rounds.length > 0) {
      fetchAndEnrichMatchups(supabase, rounds, players).then(setMatchupData);
    }
    if (activeTab === "rankings") {
      fetchAndCalculateRankings(supabase, players, rounds).then(setRankings);
    }
  }, [activeTab, rounds, players, supabase]);

  if (loading || !tournament) {
    return (
      <div className="flex flex-col h-[calc(100vh-3.5rem)] bg-surface">
        <div className="border-b border-border-theme bg-surface px-4 py-3">
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
    <div className="flex flex-col h-[calc(100vh-3.5rem)] bg-surface">
      <ThemeToggle tvAutoHide={isTvMode} controlsVisible={controlsVisible} />
      <TvModeButton isTvMode={isTvMode} controlsVisible={controlsVisible} onToggle={toggleTvMode} />
      {/* Header */}
      <div className="border-b border-border-theme bg-surface px-4 py-3">
        <div className="mx-auto max-w-4xl">
          <div>
            <h1 className="text-lg font-bold text-text-primary">
              {tournament.name}
            </h1>
            <p className="text-xs text-text-muted">
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
      <nav className="tv-bottom-nav fixed bottom-0 left-0 right-0 z-20 border-t border-border-theme bg-surface">
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
      className={`tv-tabs flex flex-1 flex-col items-center gap-0.5 py-2.5 text-xs font-medium transition-colors cursor-pointer ${
        active ? "text-blue-600" : "text-text-tertiary hover:text-text-secondary"
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
      <div className="flex flex-col items-center justify-center py-20 text-text-tertiary">
        <ClipboardList className="h-10 w-10 mb-2" />
        <p className="text-sm">No players registered yet</p>
      </div>
    );
  }

  return (
    <div>
      {/* Table Header */}
      <div className="grid grid-cols-[2.5rem_1fr_5rem] sm:grid-cols-[1fr_2fr_2fr] items-center border-b border-border-theme px-4 py-2 text-xs font-medium uppercase tracking-wider text-text-tertiary">
        <span>No.</span>
        <span>Name</span>
        <span>Gender</span>
      </div>

      {/* Table Rows */}
      {players.map((player, index) => (
        <div
          key={player.id}
          className="grid grid-cols-[2.5rem_1fr_5rem] sm:grid-cols-[1fr_2fr_2fr] items-center border-b border-border-light px-4 py-4"
        >
          <span className="text-sm text-text-tertiary">{index + 1}</span>
          <span className="text-sm font-semibold text-text-primary uppercase">
            {player.name}
          </span>
          <span className="text-sm font-bold text-text-primary uppercase">
            {player.gender}
          </span>
        </div>
      ))}
    </div>
  );
}

/* ─── Matchups Tab ─── */
function LiveMatchupsTab({
  tournament,
  rounds,
  matchupData,
}: {
  tournament: Tournament;
  rounds: Round[];
  matchupData: RoundMatchupData[];
}) {
  const [activeRound, setActiveRound] = useState(1);

  const roundTabs = Array.from(
    { length: tournament.total_rounds },
    (_, i) => i + 1
  );

  const currentRoundData = matchupData.find(
    (d) => d.round.round_number === activeRound
  );

  const playerActiveCourt = buildPlayerActiveCourts(matchupData, activeRound);
  const playerNotReady = buildPlayerNotReady(matchupData, activeRound);

  if (rounds.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-text-tertiary">
        <Swords className="h-10 w-10 mb-2" />
        <p className="text-sm">No rounds generated yet</p>
        <p className="text-xs mt-1">Check back soon!</p>
      </div>
    );
  }

  return (
    <div>
      {/* Round Tabs */}
      <div className="flex border-b border-border-theme bg-surface overflow-x-auto">
        {roundTabs.map((r) => (
          <button
            key={r}
            onClick={() => setActiveRound(r)}
            className={`tv-round-tab flex-1 min-w-[5rem] py-3 text-center text-xs font-bold uppercase tracking-wide transition-colors cursor-pointer ${
              activeRound === r
                ? "text-blue-600 border-b-3 border-blue-600"
                : "text-text-tertiary hover:text-text-secondary"
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
              className="tv-match-card rounded-xl border border-border-light bg-surface p-4 shadow-md"
            >
              {/* Card Header — status left, court right */}
              <div className="flex items-center justify-between mb-3">
                <span
                  className={`tv-badge text-xs font-semibold uppercase tracking-wide ${
                    isMatchNotReady(match, playerNotReady)
                      ? "text-red-500"
                      : getStatusColor(match.status)
                  }`}
                >
                  {isMatchNotReady(match, playerNotReady)
                    ? "Not Ready"
                    : getStatusLabel(match.status)}
                </span>
                {match.court_number > 0 && (
                  <span className="text-xs font-medium text-text-muted">
                    {getCourtLabel(match)}
                  </span>
                )}
              </div>

              {/* Team 1 */}
              <div className="flex items-center gap-2 mb-2">
                <span
                  className={`tv-score flex h-7 w-7 items-center justify-center rounded-md text-xs font-bold text-white ${
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
                      {i > 0 && <span className="text-text-tertiary">/</span>}
                      <span className="tv-player-name font-semibold text-text-primary uppercase">
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
                  className={`tv-score flex h-7 w-7 items-center justify-center rounded-md text-xs font-bold text-white ${
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
                      {i > 0 && <span className="text-text-tertiary">/</span>}
                      <span className="tv-player-name font-semibold text-text-primary uppercase">
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
          <div className="flex flex-col items-center justify-center py-16 text-text-tertiary">
            <p className="text-sm">No matches for this round yet</p>
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── Rankings Tab (no classification) ─── */
function LiveRankingsTab({
  rankings,
  roundColumns,
}: {
  rankings: LeaderboardRow[];
  roundColumns: number[];
}) {
  if (rankings.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-text-tertiary">
        <BarChart3 className="h-10 w-10 mb-2" />
        <p className="text-sm">No rankings yet</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto bg-surface">
      <table className="tv-table w-full text-left text-sm">
        <thead>
          <tr className="border-b border-border-theme text-xs uppercase tracking-wider text-text-tertiary">
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
              className={`border-b border-border-light ${
                index < 3 ? "bg-yellow-50/60" : ""
              }`}
            >
              <td className="px-4 py-3 text-text-tertiary font-medium">
                {index + 1}
              </td>
              <td className="px-4 py-3 font-semibold text-text-primary uppercase">
                {row.player.name}
              </td>
              {roundColumns.map((r) => (
                <td key={r} className="px-3 py-3 text-center text-text-secondary">
                  {row.roundScores[r] !== undefined
                    ? row.roundScores[r]
                    : "—"}
                </td>
              ))}
              <td className="px-4 py-3 text-center font-bold text-text-primary whitespace-nowrap">
                {row.total} <span className="text-xs font-medium text-text-tertiary">({ordinal(index + 1)})</span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
