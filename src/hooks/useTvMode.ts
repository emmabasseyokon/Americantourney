"use client";

import { useCallback, useEffect, useState } from "react";

/**
 * Hook for TV mode — fullscreen + enlarged UI for TVs/projectors.
 *
 * - Toggles `document.fullscreen` and `.tv-mode` class on `<html>`
 * - Auto-hides controls after 5s of no mouse movement
 * - Exits on Escape or fullscreen change
 * - Persists to sessionStorage (per-session only)
 */
export function useTvMode() {
  const [isTvMode, setIsTvMode] = useState(false);
  const [controlsVisible, setControlsVisible] = useState(true);

  // Restore from sessionStorage on mount
  useEffect(() => {
    const stored = sessionStorage.getItem("tourney-tv-mode");
    if (stored === "true" && document.fullscreenElement) {
      setIsTvMode(true);
      document.documentElement.classList.add("tv-mode");
    }
  }, []);

  // Sync .tv-mode class and sessionStorage
  useEffect(() => {
    if (isTvMode) {
      document.documentElement.classList.add("tv-mode");
      sessionStorage.setItem("tourney-tv-mode", "true");
    } else {
      document.documentElement.classList.remove("tv-mode");
      sessionStorage.removeItem("tourney-tv-mode");
    }
  }, [isTvMode]);

  // Auto-hide controls after 5s of no mouse movement in TV mode
  useEffect(() => {
    if (!isTvMode) {
      setControlsVisible(true);
      return;
    }

    let timeout: ReturnType<typeof setTimeout>;

    function showControls() {
      setControlsVisible(true);
      clearTimeout(timeout);
      timeout = setTimeout(() => setControlsVisible(false), 5000);
    }

    // Show initially, then start timer
    showControls();

    window.addEventListener("mousemove", showControls);
    window.addEventListener("touchstart", showControls);

    return () => {
      clearTimeout(timeout);
      window.removeEventListener("mousemove", showControls);
      window.removeEventListener("touchstart", showControls);
    };
  }, [isTvMode]);

  // Listen for fullscreen exit (e.g. Escape key)
  useEffect(() => {
    function onFullscreenChange() {
      if (!document.fullscreenElement && isTvMode) {
        setIsTvMode(false);
      }
    }

    document.addEventListener("fullscreenchange", onFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", onFullscreenChange);
  }, [isTvMode]);

  const toggleTvMode = useCallback(async () => {
    if (isTvMode) {
      // Exit TV mode
      if (document.fullscreenElement) {
        await document.exitFullscreen().catch(() => {});
      }
      setIsTvMode(false);
    } else {
      // Enter TV mode
      await document.documentElement.requestFullscreen().catch(() => {});
      setIsTvMode(true);
    }
  }, [isTvMode]);

  return { isTvMode, controlsVisible, toggleTvMode };
}
