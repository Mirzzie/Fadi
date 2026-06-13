"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";

/**
 * Scout is ambient — one presence the whole OS shares, not a mode you toggle into.
 * This context holds everything the persistent Scout orb and the command spotlight
 * need: whether the conversation panel is open, Scout's *living* state (so the orb
 * can breathe / listen / think / speak), an optional seed query the spotlight hands
 * off to the chat, and a proactive "nudge" the orb can surface on its own.
 *
 * There is no Desk/Scout split anymore: every screen runs inside the same shell
 * with the same ambient Scout.
 */

export type ScoutState = "idle" | "listening" | "thinking" | "working" | "speaking";

/** A proactively surfaced card the orb shows without being opened. */
export type ScoutNudge = { label: string; detail: string; href: string };

/** A query handed off from the command spotlight, tagged so the chat fires once. */
export type ScoutSeed = { text: string; nonce: number };

type ScoutPresenceValue = {
  /** Whether the Scout conversation panel is open. */
  open: boolean;
  openScout: () => void;
  closeScout: () => void;
  /** Open the panel pre-seeded with a question (from ⌘K spotlight). */
  openWithQuery: (text: string) => void;
  seed: ScoutSeed | null;
  /** Bumped each time Scout is summoned by voice, so the chat auto-starts listening. */
  voiceNonce: number;
  /** Scout's live state — drives the ambient orb's animation + the menu-bar chip. */
  state: ScoutState;
  setState: (state: ScoutState) => void;
  /** A proactive heads-up the orb surfaces (e.g. an unseen background finding). */
  nudge: ScoutNudge | null;
  showNudge: (nudge: ScoutNudge) => void;
  dismissNudge: () => void;
};

const ScoutPresenceContext = createContext<ScoutPresenceValue | null>(null);

export function ScoutPresenceProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [seed, setSeed] = useState<ScoutSeed | null>(null);
  const [voiceNonce, setVoiceNonce] = useState(0);
  const [state, setState] = useState<ScoutState>("idle");
  const [nudge, setNudge] = useState<ScoutNudge | null>(null);
  const seedNonce = useRef(0);

  const openScout = useCallback(() => setOpen(true), []);
  const closeScout = useCallback(() => setOpen(false), []);

  const openWithQuery = useCallback((text: string) => {
    const trimmed = text.trim();
    if (!trimmed) {
      setOpen(true);
      return;
    }
    seedNonce.current += 1;
    setSeed({ text: trimmed, nonce: seedNonce.current });
    setOpen(true);
  }, []);

  const showNudge = useCallback((next: ScoutNudge) => setNudge(next), []);
  const dismissNudge = useCallback(() => setNudge(null), []);

  // "Hey Scout" wake word → open the panel and trigger listening.
  useEffect(() => {
    function onSummon() {
      setOpen(true);
      setVoiceNonce((n) => n + 1);
    }
    window.addEventListener("scout:summon", onSummon);
    return () => window.removeEventListener("scout:summon", onSummon);
  }, []);

  const value = useMemo<ScoutPresenceValue>(
    () => ({
      open,
      openScout,
      closeScout,
      openWithQuery,
      seed,
      voiceNonce,
      state,
      setState,
      nudge,
      showNudge,
      dismissNudge,
    }),
    [open, openScout, closeScout, openWithQuery, seed, voiceNonce, state, nudge, showNudge, dismissNudge],
  );

  return <ScoutPresenceContext.Provider value={value}>{children}</ScoutPresenceContext.Provider>;
}

/** Fire from anywhere to summon Scout by voice (opens panel + triggers listening). */
export function summonScout() {
  window.dispatchEvent(new Event("scout:summon"));
}

export function useScout(): ScoutPresenceValue {
  const ctx = useContext(ScoutPresenceContext);
  if (!ctx) throw new Error("useScout must be used within ScoutPresenceProvider");
  return ctx;
}
