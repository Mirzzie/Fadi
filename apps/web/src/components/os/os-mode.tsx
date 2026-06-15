"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

/**
 * FadiOS has two faces you can switch between: the **ambient** living shell (Fadi
 * everywhere + your route screens) and a **desktop** with draggable app windows.
 * The choice persists per browser. Mode is client-only; it defaults to "ambient"
 * so the first render matches the server (no hydration mismatch), then hydrates.
 */

export type OsMode = "ambient" | "desktop";

const KEY = "fadios-mode";

type OsModeValue = {
  mode: OsMode;
  setMode: (mode: OsMode) => void;
  toggle: () => void;
  /** True once the persisted mode has hydrated — gate desktop-only UI on this. */
  ready: boolean;
};

const OsModeContext = createContext<OsModeValue | null>(null);

export function OsModeProvider({ children }: { children: React.ReactNode }) {
  const [mode, setModeState] = useState<OsMode>("ambient");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(KEY);
      if (stored === "ambient" || stored === "desktop") setModeState(stored);
    } catch {
      /* ignore */
    }
    setReady(true);
  }, []);

  const setMode = useCallback((next: OsMode) => {
    setModeState(next);
    try {
      localStorage.setItem(KEY, next);
    } catch {
      /* ignore */
    }
  }, []);

  const toggle = useCallback(() => setMode(mode === "ambient" ? "desktop" : "ambient"), [mode, setMode]);

  const value = useMemo<OsModeValue>(() => ({ mode, setMode, toggle, ready }), [mode, setMode, toggle, ready]);

  return <OsModeContext.Provider value={value}>{children}</OsModeContext.Provider>;
}

export function useOsMode(): OsModeValue {
  const ctx = useContext(OsModeContext);
  if (!ctx) throw new Error("useOsMode must be used within OsModeProvider");
  return ctx;
}
