"use client";

import { useTheme } from "@/components/providers/ThemeProvider";
import { Sun, Moon } from "lucide-react";

interface ThemeToggleProps {
  /** When true, auto-hides with the TV mode controls */
  tvAutoHide?: boolean;
  controlsVisible?: boolean;
}

export function ThemeToggle({ tvAutoHide, controlsVisible = true }: ThemeToggleProps) {
  const { theme, toggleTheme } = useTheme();

  return (
    <button
      onClick={toggleTheme}
      className={`fixed top-4 right-4 z-50 flex h-9 w-9 items-center justify-center rounded-full bg-surface-secondary border border-border-theme text-text-secondary hover:bg-surface-tertiary transition-all cursor-pointer shadow-lg ${
        tvAutoHide && !controlsVisible ? "opacity-0 pointer-events-none" : "opacity-100"
      }`}
      title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
    >
      {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
    </button>
  );
}
