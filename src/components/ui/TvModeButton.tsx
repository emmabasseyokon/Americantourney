"use client";

import { Monitor, Minimize2 } from "lucide-react";

interface TvModeButtonProps {
  isTvMode: boolean;
  controlsVisible: boolean;
  onToggle: () => void;
}

/**
 * Floating TV mode button for live pages.
 * Enters fullscreen + scales up the UI for TVs/projectors.
 * Auto-hides after 5s of no mouse movement when in TV mode.
 */
export function TvModeButton({ isTvMode, controlsVisible, onToggle }: TvModeButtonProps) {
  return (
    <button
      onClick={onToggle}
      className={`fixed top-4 right-14 z-50 flex h-9 w-9 items-center justify-center rounded-full bg-surface-secondary border border-border-theme text-text-secondary hover:bg-surface-tertiary transition-all cursor-pointer shadow-lg ${
        isTvMode && !controlsVisible ? "opacity-0 pointer-events-none" : "opacity-100"
      }`}
      title={isTvMode ? "Exit TV mode" : "TV mode"}
    >
      {isTvMode ? <Minimize2 className="h-4 w-4" /> : <Monitor className="h-4 w-4" />}
    </button>
  );
}
