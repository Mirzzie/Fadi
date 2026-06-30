"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";

import { subscribeFadiSpeaking } from "@/lib/voice/fadi-speech";

/**
 * Fadi is ambient — one presence the whole OS shares, not a mode you toggle into.
 * This context holds everything the persistent Fadi orb and the command spotlight
 * need: whether the conversation panel is open, Fadi's *living* state (so the orb
 * can breathe / listen / think / speak), an optional seed query the spotlight hands
 * off to the chat, and a proactive "nudge" the orb can surface on its own.
 *
 * There is no Desk/Fadi split anymore: every screen runs inside the same shell
 * with the same ambient Fadi.
 */

export type FadiState = "idle" | "listening" | "thinking" | "working" | "speaking";

/** A proactively surfaced card the orb shows without being opened. */
export type FadiNudge = { label: string; detail: string; href: string };

/** A query handed off from the command spotlight, tagged so the chat fires once. */
export type FadiSeed = { text: string; nonce: number };

type FadiPresenceValue = {
  /** Whether the Fadi conversation panel is open. */
  open: boolean;
  openFadi: () => void;
  closeFadi: () => void;
  /** Open the panel pre-seeded with a question (from ⌘K spotlight). */
  openWithQuery: (text: string) => void;
  seed: FadiSeed | null;
  /** Fadi's live state — drives the ambient orb's animation + the menu-bar chip. */
  state: FadiState;
  setState: (state: FadiState) => void;
  /** True whenever Fadi's voice is actually speaking (any source — boot, briefing, chat). */
  speaking: boolean;
  /** What the visuals should show: "speaking" while Fadi talks, else the live state. */
  displayState: FadiState;
  /** A proactive heads-up the orb surfaces (e.g. an unseen background finding). */
  nudge: FadiNudge | null;
  showNudge: (nudge: FadiNudge) => void;
  dismissNudge: () => void;
};

const FadiPresenceContext = createContext<FadiPresenceValue | null>(null);

export function FadiPresenceProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [seed, setSeed] = useState<FadiSeed | null>(null);
  const [state, setState] = useState<FadiState>("idle");
  const [nudge, setNudge] = useState<FadiNudge | null>(null);
  const [speaking, setSpeaking] = useState(false);
  const seedNonce = useRef(0);

  // The shared speech controller tells us whenever Fadi talks — premium neural
  // audio or the browser fallback — so the living core reacts to all of it.
  useEffect(() => subscribeFadiSpeaking(setSpeaking), []);

  const openFadi = useCallback(() => setOpen(true), []);
  // Clear any spotlight seed on close so reopening via the orb doesn't re-fire
  // the previous ⌘K question (each FadiChat mount resets its own seen-nonce).
  const closeFadi = useCallback(() => {
    setOpen(false);
    setSeed(null);
  }, []);

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

  const showNudge = useCallback((next: FadiNudge) => setNudge(next), []);
  const dismissNudge = useCallback(() => setNudge(null), []);

  // "Hey Fadi" wake word → open the panel and trigger listening.
  // Speech wins the visuals: while Fadi talks, show "speaking" regardless of the
  // underlying chat state.
  const displayState: FadiState = speaking ? "speaking" : state;

  const value = useMemo<FadiPresenceValue>(
    () => ({
      open,
      openFadi,
      closeFadi,
      openWithQuery,
      seed,
      state,
      setState,
      speaking,
      displayState,
      nudge,
      showNudge,
      dismissNudge,
    }),
    [open, openFadi, closeFadi, openWithQuery, seed, state, speaking, displayState, nudge, showNudge, dismissNudge],
  );

  return <FadiPresenceContext.Provider value={value}>{children}</FadiPresenceContext.Provider>;
}

export function useFadi(): FadiPresenceValue {
  const ctx = useContext(FadiPresenceContext);
  if (!ctx) throw new Error("useFadi must be used within FadiPresenceProvider");
  return ctx;
}
