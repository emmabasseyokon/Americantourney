"use client";

import { Button } from "@/components/ui/Button";
import { useSupabase } from "@/components/providers/SupabaseProvider";
import { Trophy, Menu, X } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";

export function Navbar() {
  const { user, loading } = useSupabase();
  const { supabase } = useSupabase();
  const router = useRouter();
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);

  // Hide navbar on public live pages
  if (pathname.includes("/live")) return null;

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push("/");
  }

  return (
    <nav className="border-b border-gray-200 bg-white">
      <div className="mx-auto max-w-6xl px-4">
        <div className="flex h-14 items-center justify-between">
          <Link href={user ? "/dashboard" : "/"} className="flex items-center gap-2 font-bold text-gray-900">
            <Trophy className="h-5 w-5 text-blue-600" />
            Tourney
          </Link>

          {/* Desktop nav */}
          <div className="hidden items-center gap-4 sm:flex">
            {!loading && user ? (
              <>
                <Link
                  href="/dashboard"
                  className="text-sm text-gray-600 hover:text-gray-900"
                >
                  Tournaments
                </Link>
                <Link
                  href="/scoreboards"
                  className="text-sm text-gray-600 hover:text-gray-900"
                >
                  Scoreboards
                </Link>
                <Button variant="ghost" size="sm" onClick={handleLogout}>
                  Logout
                </Button>
              </>
            ) : !loading ? (
              <Link href="/auth/login">
                <Button size="sm">Sign in</Button>
              </Link>
            ) : null}
          </div>

          {/* Mobile menu button */}
          <button
            className="sm:hidden text-gray-600"
            onClick={() => setMenuOpen(!menuOpen)}
          >
            {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>

        {/* Mobile nav */}
        {menuOpen && (
          <div className="border-t border-gray-100 pb-3 pt-2 sm:hidden">
            {!loading && user ? (
              <div className="space-y-1">
                <Link
                  href="/dashboard"
                  className="block px-2 py-1.5 text-sm text-gray-600 hover:text-gray-900"
                  onClick={() => setMenuOpen(false)}
                >
                  Tournaments
                </Link>
                <Link
                  href="/scoreboards"
                  className="block px-2 py-1.5 text-sm text-gray-600 hover:text-gray-900"
                  onClick={() => setMenuOpen(false)}
                >
                  Scoreboards
                </Link>
                <button
                  onClick={handleLogout}
                  className="block px-2 py-1.5 text-sm text-gray-600 hover:text-gray-900"
                >
                  Logout
                </button>
              </div>
            ) : !loading ? (
              <Link
                href="/auth/login"
                className="block px-2 py-1.5 text-sm text-blue-600"
                onClick={() => setMenuOpen(false)}
              >
                Sign in
              </Link>
            ) : null}
          </div>
        )}
      </div>
    </nav>
  );
}
