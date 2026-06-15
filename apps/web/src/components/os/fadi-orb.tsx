"use client";

import { ArrowUpRight, Sparkles, X } from "lucide-react";
import Link from "next/link";

import { FadiChat } from "@/components/fadi/fadi-chat";
import { cn } from "@/lib/utils";
import { useFadi, type FadiState } from "./fadi-presence";

/**
 * The ambient, *living* Fadi — present on every screen. It's not a button you
 * press to "enter assistant mode"; it's a companion that breathes while idle,
 * reacts when it listens, shimmers while it thinks, and proactively surfaces what
 * the background agency found (the nudge bubble). Clicking it — or saying
 * "Hey Fadi" — expands the conversation. The chat engine is unchanged; the orb
 * only reflects Fadi's live state and hands off seeded questions from ⌘K.
 */
export function FadiOrb() {
  const { open, openFadi, closeFadi, state, setState, voiceNonce, seed, nudge, dismissNudge } =
    useFadi();

  return (
    <>
      {/* Ambient orb + proactive nudge — hidden while the panel is open. */}
      <div
        className={cn(
          "fixed bottom-20 right-5 z-40 flex flex-col items-end gap-2",
          open && "pointer-events-none opacity-0",
        )}
      >
        {nudge ? (
          <div className="flex max-w-[16rem] animate-in items-start gap-2 rounded-2xl border border-primary/30 bg-popover/95 p-3 shadow-xl backdrop-blur-xl fade-in slide-in-from-bottom-2">
            <Link href={nudge.href} onClick={dismissNudge} className="group min-w-0 flex-1">
              <p className="text-[0.65rem] font-semibold uppercase tracking-wide text-primary">
                {nudge.label}
              </p>
              <p className="mt-0.5 line-clamp-2 text-sm text-foreground">{nudge.detail}</p>
              <span className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-primary">
                Open
                <ArrowUpRight className="size-3 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" aria-hidden="true" />
              </span>
            </Link>
            <button
              type="button"
              onClick={dismissNudge}
              aria-label="Dismiss"
              className="grid size-5 shrink-0 place-items-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
            >
              <X className="size-3" aria-hidden="true" />
            </button>
          </div>
        ) : null}

        <OrbButton state={state} onClick={openFadi} />
      </div>

      {/* Conversation panel */}
      {open ? (
        <div className="fixed inset-0 z-50">
          <button
            aria-label="Close Fadi"
            onClick={closeFadi}
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
          />
          <div className="absolute inset-y-0 right-0 flex w-full max-w-md flex-col border-l border-border/60 bg-card shadow-2xl duration-300 animate-in slide-in-from-right">
            <div className="flex h-12 shrink-0 items-center justify-between border-b border-border/60 px-4">
              <div className="flex items-center gap-2">
                <OrbButton state={state} size="sm" />
                <div className="leading-tight">
                  <span className="block text-sm font-semibold">Fadi</span>
                  <span className="block text-[0.65rem] text-muted-foreground">
                    {STATE_LABEL[state]}
                  </span>
                </div>
              </div>
              <button
                onClick={closeFadi}
                aria-label="Close"
                className="grid size-7 place-items-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
              >
                <X className="size-4" aria-hidden="true" />
              </button>
            </div>
            <div className="min-h-0 flex-1">
              <FadiChat
                autoListenNonce={voiceNonce}
                seed={seed}
                onStateChange={setState}
              />
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

const STATE_LABEL: Record<FadiState, string> = {
  idle: "Active",
  listening: "Listening…",
  thinking: "Thinking…",
  working: "Working…",
  speaking: "Speaking…",
};

/**
 * The orb itself. A teal→violet core with a state-driven aura: idle breathes,
 * listening ripples, thinking/working shimmer-spins, speaking pulses fast.
 */
function OrbButton({
  state,
  onClick,
  size = "lg",
}: {
  state: FadiState;
  onClick?: () => void;
  size?: "sm" | "lg";
}) {
  const active = state !== "idle";
  const Wrapper = onClick ? "button" : "div";
  return (
    <Wrapper
      {...(onClick ? { type: "button" as const, onClick, "aria-label": "Open Fadi" } : {})}
      className={cn(
        "group relative grid place-items-center rounded-full bg-gradient-to-br from-primary to-[oklch(0.66_0.22_285)] shadow-xl ring-2 ring-primary/30",
        onClick && "transition-transform hover:scale-105 active:scale-95",
        size === "lg" ? "size-14" : "size-7",
      )}
      data-state={state}
    >
      {/* Outer breathing / ripple aura */}
      <span
        className={cn(
          "absolute inset-0 rounded-full bg-primary/30",
          state === "listening" || state === "speaking"
            ? "animate-ping [animation-duration:1.4s]"
            : "fadi-breathe",
        )}
      />
      {/* Thinking/working shimmer ring */}
      {active && state !== "listening" ? (
        <span
          aria-hidden="true"
          className="absolute -inset-1 rounded-full border border-primary/40 fadi-orbit"
        />
      ) : null}
      <Sparkles
        className={cn(
          "relative text-primary-foreground",
          size === "lg" ? "size-6" : "size-3.5",
          state === "thinking" || state === "working" ? "animate-pulse" : "",
        )}
        aria-hidden="true"
      />
    </Wrapper>
  );
}
