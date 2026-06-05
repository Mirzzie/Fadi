"use client";

import { createContext, useContext, useEffect, useState } from "react";

/**
 * The OS has two faces the user can switch between:
 *  - "desk": the productivity desktop — menu bar + dock + app pages, Kai in a
 *    corner orb (Option 1).
 *  - "kai":  the assistant-first home — a living Kai core front and centre that
 *    greets, speaks and surfaces opportunities (Option 3).
 * Both share the same chrome (menu bar, dock, voice, Kai engine); only the home
 * surface and Kai's prominence change. The choice persists per browser.
 */

export type OsMode = "desk" | "kai";

const STORAGE_KEY = "careeros.os-mode";

type OsModeContextValue = {
  mode: OsMode;
  setMode: (mode: OsMode) => void;
  toggle: () => void;
  /** Whether the Kai conversation panel is open (Desk-mode orb / wake word). */
  kaiOpen: boolean;
  openKai: () => void;
  closeKai: () => void;
  /** Bumped each time Kai is summoned by voice, so Kai can auto-start listening. */
  kaiVoiceNonce: number;
};

const OsModeContext = createContext<OsModeContextValue | null>(null);

export function OsModeProvider({ children }: { children: React.ReactNode }) {
  const [mode, setModeState] = useState<OsMode>("desk");
  const [kaiOpen, setKaiOpen] = useState(false);
  const [kaiVoiceNonce, setKaiVoiceNonce] = useState(0);

  // Hydrate from localStorage after mount (avoids SSR mismatch).
  useEffect(() => {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored === "desk" || stored === "kai") setModeState(stored);
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
        toggle: () => setMode(mode === "desk" ? "kai" : "desk"),
        kaiOpen,
        openKai: () => setKaiOpen(true),
        closeKai: () => setKaiOpen(false),
        kaiVoiceNonce,
      }}
    >
      <VoiceSummonBridge setKaiOpen={setKaiOpen} setKaiVoiceNonce={setKaiVoiceNonce} />
      {children}
    </OsModeContext.Provider>
  );
}

// Internal: lets the menu-bar wake word both open Kai and bump the voice nonce
// via a stable event, without threading setters through every consumer.
function VoiceSummonBridge({
  setKaiOpen,
  setKaiVoiceNonce,
}: {
  setKaiOpen: (v: boolean) => void;
  setKaiVoiceNonce: (fn: (n: number) => number) => void;
}) {
  useEffect(() => {
    function onSummon() {
      setKaiOpen(true);
      setKaiVoiceNonce((n) => n + 1);
    }
    window.addEventListener("kai:summon", onSummon);
    return () => window.removeEventListener("kai:summon", onSummon);
  }, [setKaiOpen, setKaiVoiceNonce]);
  return null;
}

/** Fire from anywhere to summon Kai by voice (opens panel + triggers listening). */
export function summonKai() {
  window.dispatchEvent(new Event("kai:summon"));
}

export function useOsMode(): OsModeContextValue {
  const ctx = useContext(OsModeContext);
  if (!ctx) throw new Error("useOsMode must be used within OsModeProvider");
  return ctx;
}
