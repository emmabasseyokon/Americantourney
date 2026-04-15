"use client";

import { Button } from "@/components/ui/Button";
import { useSupabase } from "@/components/providers/SupabaseProvider";
import { Upload, Trash2, ArrowLeft, Image as ImageIcon } from "lucide-react";
import Link from "next/link";
import { useEffect, useState, useRef } from "react";

const MAX_FILE_SIZE = 500 * 1024; // 500KB
const ALLOWED_TYPES = ["image/png", "image/jpeg", "image/webp", "image/svg+xml"];

export default function SettingsPage() {
  const { supabase, user, loading } = useSupabase();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [fetching, setFetching] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    if (!user) return;

    async function fetchProfile() {
      const { data } = await supabase
        .from("profiles")
        .select("logo_url")
        .eq("id", user!.id)
        .single();

      setLogoUrl(data?.logo_url ?? null);
      setFetching(false);
    }

    fetchProfile();
  }, [user, supabase]);

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    setError("");
    setSuccess("");

    if (!ALLOWED_TYPES.includes(file.type)) {
      setError("Please upload a PNG, JPEG, WebP, or SVG image.");
      return;
    }

    if (file.size > MAX_FILE_SIZE) {
      setError("Image must be under 500KB.");
      return;
    }

    setUploading(true);

    const ext = file.name.split(".").pop() || "png";
    const filePath = `${user.id}/logo.${ext}`;

    // Upload to Supabase Storage
    const { error: uploadErr } = await supabase.storage
      .from("logos")
      .upload(filePath, file, { upsert: true });

    if (uploadErr) {
      setError("Failed to upload logo. Please try again.");
      setUploading(false);
      return;
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from("logos")
      .getPublicUrl(filePath);

    const publicUrl = `${urlData.publicUrl}?t=${Date.now()}`;

    // Save to profile
    const { error: dbErr } = await supabase
      .from("profiles")
      .update({ logo_url: publicUrl })
      .eq("id", user.id);

    if (dbErr) {
      setError("Failed to save logo. Please try again.");
      setUploading(false);
      return;
    }

    setLogoUrl(publicUrl);
    setSuccess("Logo uploaded successfully.");
    setUploading(false);

    // Reset file input
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function handleRemove() {
    if (!user) return;
    setError("");
    setSuccess("");
    setRemoving(true);

    // Remove from profile
    const { error: dbErr } = await supabase
      .from("profiles")
      .update({ logo_url: null })
      .eq("id", user.id);

    if (dbErr) {
      setError("Failed to remove logo. Please try again.");
      setRemoving(false);
      return;
    }

    // Try to delete from storage (non-critical if it fails)
    const { data: files } = await supabase.storage
      .from("logos")
      .list(user.id);

    if (files && files.length > 0) {
      await supabase.storage
        .from("logos")
        .remove(files.map((f) => `${user.id}/${f.name}`));
    }

    setLogoUrl(null);
    setSuccess("Logo removed.");
    setRemoving(false);
  }

  if (loading || fetching) {
    return (
      <div className="flex flex-col h-[calc(100vh-3.5rem)] bg-surface">
        <div className="bg-blue-600 px-4 py-4">
          <div className="h-5 w-40 animate-pulse rounded bg-blue-400" />
        </div>
        <div className="p-6">
          <div className="h-32 w-32 mx-auto animate-pulse rounded-xl bg-surface-secondary" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[calc(100vh-3.5rem)] bg-surface">
      {/* Header */}
      <div className="bg-blue-600 px-4 py-4 flex items-center gap-3">
        <Link href="/dashboard" className="text-white/80 hover:text-white">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <h1 className="text-lg font-bold text-white">Settings</h1>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        <div className="mx-auto max-w-md">
          {/* Logo section */}
          <div className="rounded-xl border border-border-theme bg-surface-secondary p-6">
            <h2 className="text-sm font-bold text-text-primary mb-1">Club / Event Logo</h2>
            <p className="text-xs text-text-muted mb-4">
              Your logo appears on all live scoreboard and tournament pages.
              Max 500KB, PNG/JPEG/WebP/SVG.
            </p>

            {/* Preview */}
            <div className="flex items-center justify-center mb-4">
              {logoUrl ? (
                <div className="relative">
                  <img
                    src={logoUrl}
                    alt="Logo"
                    className="h-20 max-w-[200px] object-contain rounded-lg"
                  />
                </div>
              ) : (
                <div className="flex h-20 w-40 items-center justify-center rounded-lg border-2 border-dashed border-border-theme">
                  <ImageIcon className="h-8 w-8 text-text-tertiary" />
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="flex gap-3">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp,image/svg+xml"
                onChange={handleUpload}
                className="hidden"
              />
              <Button
                onClick={() => fileInputRef.current?.click()}
                className="flex-1 bg-blue-600 hover:bg-blue-700"
                disabled={uploading}
              >
                <Upload className="h-4 w-4 mr-1.5" />
                {uploading ? "Uploading..." : logoUrl ? "Replace" : "Upload Logo"}
              </Button>
              {logoUrl && (
                <Button
                  variant="ghost"
                  onClick={handleRemove}
                  disabled={removing}
                  className="text-red-600 hover:bg-red-50"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </div>

            {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
            {success && <p className="mt-3 text-sm text-green-600">{success}</p>}
          </div>
        </div>
      </div>
    </div>
  );
}
