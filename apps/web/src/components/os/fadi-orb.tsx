"use client";

import { ArrowUpRight, X } from "lucide-react";
import Link from "next/link";

import { FadiChat } from "@/components/fadi/fadi-chat";
import { cn } from "@/lib/utils";
import { FadiCore } from "./fadi-core";
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
  const { open, openFadi, closeFadi, displayState, setState, voiceNonce, seed, nudge, dismissNudge } =
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

        <OrbButton state={displayState} onClick={openFadi} />
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
                <OrbButton state={displayState} size="sm" />
                <div className="leading-tight">
                  <span className="block text-sm font-semibold">Fadi</span>
                  <span className="block text-[0.65rem] text-muted-foreground">
                    {STATE_LABEL[displayState]}
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

/** The orb is the living Fadi core, made clickable when it's the ambient launcher. */
function OrbButton({
  state,
  onClick,
  size = "lg",
}: {
  state: FadiState;
  onClick?: () => void;
  size?: "sm" | "lg";
}) {
  const px = size === "lg" ? 56 : 28;
  const Wrapper = onClick ? "button" : "div";
  return (
    <Wrapper
      {...(onClick ? { type: "button" as const, onClick, "aria-label": "Open Fadi" } : {})}
      className={cn(
        "group grid place-items-center rounded-full",
        onClick && "transition-transform hover:scale-105 active:scale-95",
      )}
      data-state={state}
    >
      <FadiCore state={state} size={px} />
    </Wrapper>
  );
}
