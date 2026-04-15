"use client";

import { Button } from "@/components/ui/Button";
import { useSupabase } from "@/components/providers/SupabaseProvider";
import type { Tournament } from "@/types/database";
import { SkeletonList } from "@/components/ui/Skeleton";
import { sanitizeString } from "@/lib/utils/security";
import { usePaymentGate } from "@/hooks/usePaymentGate";
import { Plus, MoreVertical, Trophy, X, AlertCircle, Upload } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

const MAX_LOGO_SIZE = 2 * 1024 * 1024;
const ALLOWED_LOGO_TYPES = ["image/png", "image/jpeg", "image/webp", "image/svg+xml"];

export default function DashboardPage() {
  const { supabase, user, loading } = useSupabase();
  const router = useRouter();
  const { isFree, loading: paymentLoading, getButtonLabel, initializePayment } = usePaymentGate("tournament");
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [fetching, setFetching] = useState(true);

  // Payment failed banner
  const [paymentFailed, setPaymentFailed] = useState(false);

  // Create modal state
  const [showModal, setShowModal] = useState(false);
  const [name, setName] = useState("");
  const [totalRounds, setTotalRounds] = useState("5");
  const [maxPlayers, setMaxPlayers] = useState("32");
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState("");
  const [creating, setCreating] = useState(false);

  // Kebab menu / edit / delete state
  const [menuOpen, setMenuOpen] = useState<string | null>(null);
  const [editingTournament, setEditingTournament] = useState<Tournament | null>(null);
  const [editName, setEditName] = useState("");
  const [editRounds, setEditRounds] = useState("5");
  const [editPlayers, setEditPlayers] = useState("32");
  const [editError, setEditError] = useState("");
  const [editSaving, setEditSaving] = useState(false);
  const [deletingTournament, setDeletingTournament] = useState<Tournament | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    // Check for payment failure from callback redirect
    const params = new URLSearchParams(window.location.search);
    if (params.get("payment") === "failed" || params.get("payment") === "error") {
      setPaymentFailed(true);
      // Clean URL
      window.history.replaceState({}, "", "/dashboard");
    }
  }, []);

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

  function handleLogoSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!ALLOWED_LOGO_TYPES.includes(file.type)) {
      setError("Logo must be PNG, JPEG, WebP, or SVG.");
      return;
    }
    if (file.size > MAX_LOGO_SIZE) {
      setError("Logo must be under 2MB.");
      return;
    }
    setError("");
    setLogoFile(file);
    setLogoPreview(URL.createObjectURL(file));
  }

  async function uploadLogo(): Promise<string | null> {
    if (!logoFile || !user) return null;
    const ext = logoFile.name.split(".").pop() || "png";
    const filePath = `${user.id}/${Date.now()}.${ext}`;
    const { error: uploadErr } = await supabase.storage
      .from("logos")
      .upload(filePath, logoFile, { upsert: true });
    if (uploadErr) throw new Error("Failed to upload logo.");
    const { data: urlData } = supabase.storage.from("logos").getPublicUrl(filePath);
    return urlData.publicUrl;
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    setError("");
    setCreating(true);

    const cleanName = sanitizeString(name, 100);
    if (!cleanName) {
      setError("Tournament name is required.");
      setCreating(false);
      return;
    }

    try {
      let logoUrl: string | null = null;
      if (logoFile) {
        logoUrl = await uploadLogo();
      }

      const result = await initializePayment({
        name: cleanName,
        total_rounds: parseInt(totalRounds),
        max_players: parseInt(maxPlayers),
        logo_url: logoUrl,
      });

      if (result.free) {
        router.push(`/tournaments/${result.item_id}`);
      } else {
        // Redirect to Paystack checkout
        window.location.href = result.authorization_url;
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not complete the request. Please try again.");
      setCreating(false);
    }
  }

  async function handleEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editingTournament) return;
    setEditError("");
    setEditSaving(true);

    const cleanName = sanitizeString(editName, 100);
    if (!cleanName) {
      setEditError("Tournament name is required.");
      setEditSaving(false);
      return;
    }

    const { error: dbError } = await supabase
      .from("tournaments")
      .update({
        name: cleanName,
        total_rounds: parseInt(editRounds),
        max_players: parseInt(editPlayers),
      })
      .eq("id", editingTournament.id);

    if (dbError) {
      setEditError("Could not save changes. Please try again.");
      setEditSaving(false);
      return;
    }

    setTournaments((prev) =>
      prev.map((t) =>
        t.id === editingTournament.id
          ? { ...t, name: cleanName, total_rounds: parseInt(editRounds) as 3 | 4 | 5, max_players: parseInt(editPlayers) as 8 | 16 | 32 | 64 }
          : t
      )
    );
    setEditingTournament(null);
    setEditSaving(false);
  }

  async function handleDelete() {
    if (!deletingTournament) return;
    setDeleting(true);

    await supabase.from("tournaments").delete().eq("id", deletingTournament.id);

    setTournaments((prev) => prev.filter((t) => t.id !== deletingTournament.id));
    setDeletingTournament(null);
    setDeleting(false);
  }

  if (loading || fetching) {
    return (
      <div className="flex flex-col h-[calc(100vh-3.5rem)] bg-surface">
        <div className="bg-blue-600 px-4 py-4">
          <div className="h-5 w-40 animate-pulse rounded bg-blue-400" />
        </div>
        <SkeletonList rows={8} />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[calc(100vh-3.5rem)] bg-surface">
      {/* Header */}
      <div className="bg-blue-600 px-4 py-4">
        <h1 className="text-lg font-bold text-white">American Tournaments</h1>
      </div>

      {/* Payment Failed Banner */}
      {paymentFailed && (
        <div className="flex items-center gap-2 bg-red-50 border-b border-red-200 px-4 py-3">
          <AlertCircle className="h-4 w-4 text-red-600 shrink-0" />
          <p className="text-sm text-red-700">Payment was not completed. Please try again.</p>
          <button onClick={() => setPaymentFailed(false)} className="ml-auto text-red-400 hover:text-red-600 cursor-pointer">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Tournament List */}
      <div className="flex-1 overflow-y-auto">
        {tournaments.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-text-tertiary">
            <Trophy className="h-10 w-10 mb-2" />
            <p className="text-sm">No tournaments yet</p>
            <p className="text-xs mt-1">Tap + to create your first tournament</p>
          </div>
        ) : (
          <div>
            {tournaments.map((tournament) => (
              <div
                key={tournament.id}
                className="flex items-center justify-between border-b border-border-light px-4 py-4"
              >
                <Link
                  href={`/tournaments/${tournament.id}`}
                  className="flex-1 text-sm font-medium text-text-primary hover:text-blue-600 transition-colors"
                >
                  {tournament.name}
                </Link>
                <div className="relative">
                  <button
                    onClick={() =>
                      setMenuOpen(menuOpen === tournament.id ? null : tournament.id)
                    }
                    className="p-1 text-text-tertiary hover:text-gray-600 transition-colors cursor-pointer"
                  >
                    <MoreVertical className="h-4 w-4" />
                  </button>

                  {menuOpen === tournament.id && (
                    <>
                      <div
                        className="fixed inset-0 z-30"
                        onClick={() => setMenuOpen(null)}
                      />
                      <div className="absolute right-0 top-8 z-40 w-36 rounded-lg border border-border-theme bg-surface py-1 shadow-lg">
                        <button
                          onClick={() => {
                            setEditingTournament(tournament);
                            setEditName(tournament.name);
                            setEditRounds(String(tournament.total_rounds));
                            setEditPlayers(String(tournament.max_players));
                            setEditError("");
                            setMenuOpen(null);
                          }}
                          className="flex w-full items-center px-4 py-2.5 text-sm text-text-secondary hover:bg-surface-secondary cursor-pointer"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => {
                            setDeletingTournament(tournament);
                            setMenuOpen(null);
                          }}
                          className="flex w-full items-center px-4 py-2.5 text-sm text-red-600 hover:bg-surface-secondary cursor-pointer"
                        >
                          Delete
                        </button>
                      </div>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* FAB */}
      <button
        onClick={() => setShowModal(true)}
        className="fixed bottom-6 right-6 z-30 flex h-14 w-14 items-center justify-center rounded-full bg-blue-600 text-white shadow-lg hover:bg-blue-700 transition-colors cursor-pointer"
      >
        <Plus className="h-6 w-6" />
      </button>

      {/* Edit Tournament Modal */}
      {editingTournament && (
        <div className="fixed inset-0 z-40 flex items-end sm:items-center justify-center bg-black/40">
          <div className="w-full max-w-md rounded-t-2xl sm:rounded-lg bg-surface shadow-xl overflow-hidden">
            <div className="flex items-center justify-between bg-blue-600 px-5 py-4">
              <h2 className="text-base font-bold text-white">Edit tournament</h2>
              <button
                onClick={() => {
                  setEditingTournament(null);
                  setEditError("");
                }}
                className="text-white/80 hover:text-white cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            {(() => {
              const locked = editingTournament.status === "in_progress" || editingTournament.status === "completed";
              return (
                <form onSubmit={handleEdit} className="p-5 space-y-0">
                  {locked && (
                    <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 text-xs text-amber-700 mb-3">
                      Draws have been locked. Tournament details cannot be edited.
                    </div>
                  )}
                  <div className="border-b border-border-theme py-3">
                    <input
                      type="text"
                      placeholder="Tournament name"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      required
                      disabled={locked}
                      className={`w-full text-sm bg-transparent outline-none placeholder:text-text-tertiary ${locked ? "text-text-tertiary" : "text-text-primary"}`}
                    />
                  </div>
                  <div className="flex items-center justify-between border-b border-border-theme py-3">
                    <span className="text-sm text-text-muted">No of players</span>
                    <select
                      value={editPlayers}
                      onChange={(e) => setEditPlayers(e.target.value)}
                      disabled={locked}
                      className={`text-sm font-medium bg-transparent outline-none ${locked ? "text-text-tertiary" : "text-text-primary cursor-pointer"}`}
                    >
                      <option value="8">8 Players</option>
                      <option value="16">16 Players</option>
                      <option value="32">32 Players</option>
                      <option value="64">64 Players</option>
                    </select>
                  </div>
                  <div className="flex items-center justify-between border-b border-border-theme py-3">
                    <span className="text-sm text-text-muted">No of rounds</span>
                    <select
                      value={editRounds}
                      onChange={(e) => setEditRounds(e.target.value)}
                      disabled={locked}
                      className={`text-sm font-medium bg-transparent outline-none ${locked ? "text-text-tertiary" : "text-text-primary cursor-pointer"}`}
                    >
                      <option value="3">3 Rounds</option>
                      <option value="4">4 Rounds</option>
                      <option value="5">5 Rounds</option>
                    </select>
                  </div>
                  {editError && (
                    <p className="pt-3 text-sm text-red-600">{editError}</p>
                  )}
                  <div className="pt-4">
                    <Button
                      type="submit"
                      className="w-full bg-blue-500 hover:bg-blue-600"
                      disabled={editSaving || locked}
                    >
                      {editSaving ? "Saving..." : "SAVE"}
                    </Button>
                  </div>
                </form>
              );
            })()}
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deletingTournament && (
        <div className="fixed inset-0 z-40 flex items-end sm:items-center justify-center bg-black/40">
          <div className="w-full max-w-sm rounded-t-2xl sm:rounded-lg bg-surface p-6 shadow-xl">
            <h2 className="text-lg font-bold text-text-primary">Delete tournament?</h2>
            <p className="mt-2 text-sm text-text-muted">
              Are you sure you want to delete <strong>{deletingTournament.name}</strong>? This action cannot be undone.
            </p>
            <div className="mt-5 flex gap-3 justify-end">
              <button
                onClick={() => setDeletingTournament(null)}
                className="rounded-lg px-4 py-2 text-sm font-medium text-text-secondary hover:bg-surface-secondary transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 transition-colors disabled:opacity-50 cursor-pointer"
              >
                {deleting ? "Deleting..." : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Tournament Modal */}
      {showModal && (
        <div className="fixed inset-0 z-40 flex items-end sm:items-center justify-center bg-black/40">
          <div className="w-full max-w-md rounded-t-2xl sm:rounded-lg bg-surface shadow-xl overflow-hidden">
            {/* Modal Header */}
            <div className="flex items-center justify-between bg-blue-600 px-5 py-4">
              <h2 className="text-base font-bold text-white">Add tournament</h2>
              <button
                onClick={() => {
                  setShowModal(false);
                  setError("");
                  setName("");
                  setLogoFile(null);
                  setLogoPreview(null);
                  if (logoInputRef.current) logoInputRef.current.value = "";
                }}
                className="text-white/80 hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Modal Body */}
            <form onSubmit={handleCreate} className="p-5 space-y-0">
              <div className="border-b border-border-theme py-3">
                <input
                  type="text"
                  placeholder="Tournament name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  className="w-full text-sm text-text-primary bg-transparent outline-none placeholder:text-text-tertiary"
                />
              </div>

              <div className="flex items-center justify-between border-b border-border-theme py-3">
                <span className="text-sm text-text-muted">No of players</span>
                <select
                  value={maxPlayers}
                  onChange={(e) => setMaxPlayers(e.target.value)}
                  className="text-sm font-medium text-text-primary bg-transparent outline-none cursor-pointer"
                >
                  <option value="8">8 Players</option>
                  <option value="16">16 Players</option>
                  <option value="32">32 Players</option>
                  <option value="64">64 Players</option>
                </select>
              </div>

              <div className="flex items-center justify-between border-b border-border-theme py-3">
                <span className="text-sm text-text-muted">No of rounds</span>
                <select
                  value={totalRounds}
                  onChange={(e) => setTotalRounds(e.target.value)}
                  className="text-sm font-medium text-text-primary bg-transparent outline-none cursor-pointer"
                >
                  <option value="3">3 Rounds</option>
                  <option value="4">4 Rounds</option>
                  <option value="5">5 Rounds</option>
                </select>
              </div>

              <div className="border-b border-border-theme py-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-text-muted">Logo (optional)</span>
                  <input
                    ref={logoInputRef}
                    type="file"
                    accept="image/png,image/jpeg,image/webp,image/svg+xml"
                    onChange={handleLogoSelect}
                    className="hidden"
                  />
                  <button
                    type="button"
                    onClick={() => logoInputRef.current?.click()}
                    className="flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-700 cursor-pointer"
                  >
                    <Upload className="h-3.5 w-3.5" />
                    {logoPreview ? "Change" : "Upload"}
                  </button>
                </div>
                {logoPreview && (
                  <div className="mt-2 flex items-center gap-2">
                    <img src={logoPreview} alt="Logo" className="h-8 max-w-[100px] object-contain rounded" />
                    <button
                      type="button"
                      onClick={() => { setLogoFile(null); setLogoPreview(null); if (logoInputRef.current) logoInputRef.current.value = ""; }}
                      className="text-xs text-red-500 hover:text-red-600 cursor-pointer"
                    >
                      Remove
                    </button>
                  </div>
                )}
              </div>

              {error && (
                <p className="pt-3 text-sm text-red-600">{error}</p>
              )}

              <div className="pt-4">
                <Button
                  type="submit"
                  className="w-full bg-blue-500 hover:bg-blue-600"
                  disabled={creating || paymentLoading}
                >
                  {creating ? "Processing..." : getButtonLabel()}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
