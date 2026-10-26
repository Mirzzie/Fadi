"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { subscribeFadiSpeaking } from "@/lib/voice/fadi-speech";
import type { FadiRuntimeState } from "@/lib/agent/state";
import { usePathname } from "next/navigation";
import {
  targetInView,
  targetIsUsable,
  type GuideTarget,
  type GuideTargetId,
} from "@/lib/agent/guide";

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

export type FadiState = FadiRuntimeState;

/** A proactively surfaced card the orb shows without being opened. */
export type FadiNudge = { label: string; detail: string; href: string };

/** A query handed off from the command spotlight, tagged so the chat fires once. */
export type FadiSeed = { text: string; nonce: number };

/**
 * The piece of work the conversation is about. Fadi opened from a step answers for that step,
 * and its turns are stored as that work's thread rather than in the one long general history.
 */
export type FadiFocus = { workItemId: string; title: string };

type FadiPresenceValue = {
  guide: GuideTarget | null;
  guideNotice: string | null;
  guideTargetCount: number;
  registerGuideTarget: (target: GuideTarget) => () => void;
  startGuide: (id?: GuideTargetId) => void;
  stopGuide: () => void;
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
  /** The work this conversation is about; null is the general conversation. */
  focus: FadiFocus | null;
  /** Open Fadi on a piece of work, optionally with a first question. */
  openOnWork: (focus: FadiFocus, text?: string) => void;
  /** Step back out to the general conversation. */
  clearFocus: () => void;
  /** A proactive heads-up the orb surfaces (e.g. an unseen background finding). */
  nudge: FadiNudge | null;
  showNudge: (nudge: FadiNudge) => void;
  dismissNudge: () => void;
};

const FadiPresenceContext = createContext<FadiPresenceValue | null>(null);

export function FadiPresenceProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const targets = useRef(new Map<GuideTargetId, GuideTarget>());
  const guideTrigger = useRef<HTMLElement | null>(null);
  const [guide, setGuide] = useState<GuideTarget | null>(null);
  const [guideNotice, setGuideNotice] = useState<string | null>(null);
  const [guideTargetCount, setGuideTargetCount] = useState(0);
  const stopGuide = useCallback(() => {
    setGuide(null);
    setGuideNotice(null);
    const trigger = guideTrigger.current;
    guideTrigger.current = null;
    if (trigger)
      requestAnimationFrame(() => {
        if (targetIsUsable(trigger)) trigger.focus({ preventScroll: true });
      });
  }, []);
  const registerGuideTarget = useCallback((target: GuideTarget) => {
    if (targets.current.has(target.id)) return () => {};
    targets.current.set(target.id, target);
    setGuideTargetCount(targets.current.size);
    return () => {
      if (targets.current.get(target.id) !== target) return;
      targets.current.delete(target.id);
      setGuideTargetCount(targets.current.size);
      setGuide((current) => (current === target ? null : current));
    };
  }, []);
  const startGuide = useCallback(
    (id?: GuideTargetId) => {
      const target = id
        ? targets.current.get(id)
        : [...targets.current.values()].find(
            (candidate) => candidate.pathname === pathname && targetIsUsable(candidate.element)
          );
      if (!target || target.pathname !== pathname || !targetIsUsable(target.element)) {
        setGuide(null);
        setGuideNotice("That control is no longer available on this page.");
        return;
      }
      if (
        !targetInView(target.element.getBoundingClientRect(), window.innerWidth, window.innerHeight)
      ) {
        setGuide(null);
        setGuideNotice("Bring the next control into view, then choose Show me again.");
        return;
      }
      guideTrigger.current =
        document.activeElement instanceof HTMLElement ? document.activeElement : null;
      setGuideNotice(null);
      setGuide(target);
    },
    [pathname]
  );
  const [open, setOpen] = useState(false);
  const [seed, setSeed] = useState<FadiSeed | null>(null);
  const [state, setState] = useState<FadiState>("ready");
  const [nudge, setNudge] = useState<FadiNudge | null>(null);
  const [focus, setFocus] = useState<FadiFocus | null>(null);
  const [speaking, setSpeaking] = useState(false);
  const seedNonce = useRef(0);

  // The shared speech controller tells us whenever Fadi talks — premium neural
  // audio or the browser fallback — so the living core reacts to all of it.
  useEffect(() => subscribeFadiSpeaking(setSpeaking), []);

  const openFadi = useCallback(() => {
    stopGuide();
    setOpen(true);
  }, [stopGuide]);
  // Clear any spotlight seed on close so reopening via the orb doesn't re-fire
  // the previous ⌘K question (each FadiChat mount resets its own seen-nonce).
  const closeFadi = useCallback(() => {
    setOpen(false);
    setSeed(null);
  }, []);

  const openWithQuery = useCallback(
    (text: string) => {
      stopGuide();
      const trimmed = text.trim();
      if (!trimmed) {
        setOpen(true);
        return;
      }
      seedNonce.current += 1;
      setSeed({ text: trimmed, nonce: seedNonce.current });
      setOpen(true);
    },
    [stopGuide]
  );

  const openOnWork = useCallback(
    (next: FadiFocus, text?: string) => {
      stopGuide();
      setFocus(next);
      const trimmed = text?.trim();
      if (trimmed) {
        seedNonce.current += 1;
        setSeed({ text: trimmed, nonce: seedNonce.current });
      }
      setOpen(true);
    },
    [stopGuide]
  );
  const clearFocus = useCallback(() => setFocus(null), []);

  const showNudge = useCallback((next: FadiNudge) => setNudge(next), []);
  const dismissNudge = useCallback(() => setNudge(null), []);

  // "Hey Fadi" wake word → open the panel and trigger listening.
  // Speech wins the visuals: while Fadi talks, show "speaking" regardless of the
  // underlying chat state.
  const displayState: FadiState = speaking ? "speaking" : state;

  const value = useMemo<FadiPresenceValue>(
    () => ({
      guide: guide?.pathname === pathname ? guide : null,
      guideNotice,
      guideTargetCount,
      registerGuideTarget,
      startGuide,
      stopGuide,
      open,
      openFadi,
      closeFadi,
      openWithQuery,
      seed,
      state,
      setState,
      speaking,
      displayState,
      focus,
      openOnWork,
      clearFocus,
      nudge,
      showNudge,
      dismissNudge,
    }),
    [
      guide,
      pathname,
      guideNotice,
      guideTargetCount,
      registerGuideTarget,
      startGuide,
      stopGuide,
      open,
      openFadi,
      closeFadi,
      openWithQuery,
      seed,
      state,
      speaking,
      displayState,
      focus,
      openOnWork,
      clearFocus,
      nudge,
      showNudge,
      dismissNudge,
    ]
  );

  return <FadiPresenceContext.Provider value={value}>{children}</FadiPresenceContext.Provider>;
}

export function useFadi(): FadiPresenceValue {
  const ctx = useContext(FadiPresenceContext);
  if (!ctx) throw new Error("useFadi must be used within FadiPresenceProvider");
  return ctx;
}
