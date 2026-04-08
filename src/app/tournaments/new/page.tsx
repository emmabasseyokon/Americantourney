"use client";

import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { useSupabase } from "@/components/providers/SupabaseProvider";
import { sanitizeString } from "@/lib/utils/security";
import { useRouter } from "next/navigation";
import { useState } from "react";

export default function NewTournamentPage() {
  const { supabase, user } = useSupabase();
  const router = useRouter();
  const [name, setName] = useState("");
  const [totalRounds, setTotalRounds] = useState("4");
  const [maxPlayers, setMaxPlayers] = useState("16");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    setError("");
    setLoading(true);

    const cleanName = sanitizeString(name, 100);
    if (!cleanName) {
      setError("Tournament name is required.");
      setLoading(false);
      return;
    }

    const { data, error: dbError } = await supabase
      .from("tournaments")
      .insert({
        name: cleanName,
        total_rounds: parseInt(totalRounds),
        max_players: parseInt(maxPlayers),
        status: "registration",
        created_by: user.id,
      })
      .select()
      .single();

    if (dbError) {
      setError(dbError.message);
      setLoading(false);
      return;
    }

    router.push(`/tournaments/${data.id}`);
  }

  return (
    <div className="mx-auto max-w-md px-4 py-8">
      <h1 className="text-2xl font-bold text-text-primary">Create Tournament</h1>

      <form onSubmit={handleSubmit} className="mt-6 space-y-4">
        <Input
          id="name"
          label="Tournament Name"
          type="text"
          placeholder="Summer Padel Cup"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />

        <Select
          id="rounds"
          label="Number of Rounds"
          value={totalRounds}
          onChange={(e) => setTotalRounds(e.target.value)}
          options={[
            { value: "3", label: "3 Rounds" },
            { value: "4", label: "4 Rounds" },
            { value: "5", label: "5 Rounds" },
          ]}
        />

        <Select
          id="players"
          label="Number of Players"
          value={maxPlayers}
          onChange={(e) => setMaxPlayers(e.target.value)}
          options={[
            { value: "8", label: "8 Players" },
            { value: "16", label: "16 Players" },
            { value: "32", label: "32 Players" },
            { value: "64", label: "64 Players" },
          ]}
        />

        {error && <p className="text-sm text-red-600">{error}</p>}

        <Button type="submit" className="w-full" disabled={loading}>
          {loading ? "Creating..." : "Create Tournament"}
        </Button>
      </form>
    </div>
  );
}
