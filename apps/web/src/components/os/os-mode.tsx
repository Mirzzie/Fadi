"use client";

import { createContext, useContext, useEffect, useState } from "react";

/**
 * The OS has two faces the user can switch between:
 *  - "desk": the productivity desktop — menu bar + dock + app pages, Scout in a
 *    corner orb (Option 1).
 *  - "scout":  the assistant-first home — a living Scout core front and centre that
 *    greets, speaks and surfaces opportunities (Option 3).
 * Both share the same chrome (menu bar, dock, voice, Scout engine); only the home
 * surface and Scout's prominence change. The choice persists per browser.
 */

export type OsMode = "desk" | "scout";

const STORAGE_KEY = "careeros.os-mode";

type OsModeContextValue = {
  mode: OsMode;
  setMode: (mode: OsMode) => void;
  toggle: () => void;
  /** Whether the Scout conversation panel is open (Desk-mode orb / wake word). */
  scoutOpen: boolean;
  openScout: () => void;
  closeScout: () => void;
  /** Bumped each time Scout is summoned by voice, so Scout can auto-start listening. */
  scoutVoiceNonce: number;
};

const OsModeContext = createContext<OsModeContextValue | null>(null);

export function OsModeProvider({ children }: { children: React.ReactNode }) {
  const [mode, setModeState] = useState<OsMode>("desk");
  const [scoutOpen, setScoutOpen] = useState(false);
  const [scoutVoiceNonce, setScoutVoiceNonce] = useState(0);

  // Hydrate from localStorage after mount (avoids SSR mismatch).
  useEffect(() => {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored === "desk" || stored === "scout") setModeState(stored);
  }, []);

  function setMode(next: OsMode) {
    setModeState(next);
    window.localStorage.setItem(STORAGE_KEY, next);
  }

  return (
    <OsModeContext.Provider
      value={{
        mode,
        setMode,
        toggle: () => setMode(mode === "desk" ? "scout" : "desk"),
        scoutOpen,
        openScout: () => setScoutOpen(true),
        closeScout: () => setScoutOpen(false),
        scoutVoiceNonce,
      }}
    >
      <VoiceSummonBridge setScoutOpen={setScoutOpen} setScoutVoiceNonce={setScoutVoiceNonce} />
      {children}
    </OsModeContext.Provider>
  );
}

// Internal: lets the menu-bar wake word both open Scout and bump the voice nonce
// via a stable event, without threading setters through every consumer.
function VoiceSummonBridge({
  setScoutOpen,
  setScoutVoiceNonce,
}: {
  setScoutOpen: (v: boolean) => void;
  setScoutVoiceNonce: (fn: (n: number) => number) => void;
}) {
  useEffect(() => {
    function onSummon() {
      setScoutOpen(true);
      setScoutVoiceNonce((n) => n + 1);
    }
    window.addEventListener("scout:summon", onSummon);
    return () => window.removeEventListener("scout:summon", onSummon);
  }, [setScoutOpen, setScoutVoiceNonce]);
  return null;
}

/** Fire from anywhere to summon Scout by voice (opens panel + triggers listening). */
export function summonScout() {
  window.dispatchEvent(new Event("scout:summon"));
}

export function useOsMode(): OsModeContextValue {
  const ctx = useContext(OsModeContext);
  if (!ctx) throw new Error("useOsMode must be used within OsModeProvider");
  return ctx;
}
