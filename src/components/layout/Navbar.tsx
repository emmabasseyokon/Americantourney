"use client";

import { Button } from "@/components/ui/Button";
import { useSupabase } from "@/components/providers/SupabaseProvider";
import { useTheme } from "@/components/providers/ThemeProvider";
import { Trophy, Menu, X, Sun, Moon } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";

export function Navbar() {
  const { user, loading } = useSupabase();
  const { supabase } = useSupabase();
  const { theme, toggleTheme } = useTheme();
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
    <nav className="border-b border-border-theme bg-surface">
      <div className="mx-auto max-w-6xl px-4">
        <div className="flex h-14 items-center justify-between">
          <Link href={user ? "/dashboard" : "/"} className="flex items-center gap-2 font-bold text-text-primary">
            <Trophy className="h-5 w-5 text-blue-600" />
            Tourney
          </Link>

          {/* Desktop nav */}
          <div className="hidden items-center gap-4 sm:flex">
            {!loading && user ? (
              <>
                <Link
                  href="/dashboard"
                  className="text-sm text-text-secondary hover:text-text-primary"
                >
                  Tournaments
                </Link>
                <Link
                  href="/scoreboards"
                  className="text-sm text-text-secondary hover:text-text-primary"
                >
                  Scoreboards
                </Link>
                <button
                  onClick={toggleTheme}
                  className="p-2 rounded-lg text-text-secondary hover:bg-surface-secondary transition-colors cursor-pointer"
                  title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
                >
                  {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
                </button>
                <Button variant="ghost" size="sm" onClick={handleLogout}>
                  Logout
                </Button>
              </>
            ) : !loading ? (
              <div className="flex items-center gap-2">
                <button
                  onClick={toggleTheme}
                  className="p-2 rounded-lg text-text-secondary hover:bg-surface-secondary transition-colors cursor-pointer"
                  title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
                >
                  {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
                </button>
                <Link href="/auth/login">
                  <Button size="sm">Sign in</Button>
                </Link>
              </div>
            ) : null}
          </div>

          {/* Mobile menu button */}
          <div className="flex items-center gap-2 sm:hidden">
            <button
              onClick={toggleTheme}
              className="p-2 rounded-lg text-text-secondary hover:bg-surface-secondary transition-colors cursor-pointer"
            >
              {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>
            <button
              className="text-text-secondary"
              onClick={() => setMenuOpen(!menuOpen)}
            >
              {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>

        {/* Mobile nav */}
        {menuOpen && (
          <div className="border-t border-border-theme pb-3 pt-2 sm:hidden">
            {!loading && user ? (
              <div className="space-y-1">
                <Link
                  href="/dashboard"
                  className="block px-2 py-1.5 text-sm text-text-secondary hover:text-text-primary"
                  onClick={() => setMenuOpen(false)}
                >
                  Tournaments
                </Link>
                <Link
                  href="/scoreboards"
                  className="block px-2 py-1.5 text-sm text-text-secondary hover:text-text-primary"
                  onClick={() => setMenuOpen(false)}
                >
                  Scoreboards
                </Link>
                <button
                  onClick={handleLogout}
                  className="block px-2 py-1.5 text-sm text-text-secondary hover:text-text-primary"
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
