"use client";

import { ArrowUpRight, Ear, Loader2, MessageSquare, MicOff, X } from "lucide-react";
import Link from "next/link";
import { useRef } from "react";
import { motion, useReducedMotion } from "framer-motion";

import { FadiChat } from "@/components/fadi/fadi-chat";
import { FADI_STATE_LABEL } from "@/lib/agent/state";
import { cn } from "@/lib/utils";
import { VOICE_SESSION_LABEL, voicePhaseToFadiState } from "@/lib/voice/session-state";
import { FadiCore } from "./fadi-core";
import { useFadi, type FadiState } from "./fadi-presence";
import { useVoiceMode } from "./use-voice-mode";
import { useOrbGuide } from "./use-orb-guide";

/**
 * The ambient, *living* Fadi — present on every screen. It's not a button you
 * press to "enter assistant mode"; it's a companion that breathes while idle,
 * reacts when it listens, shimmers while it thinks, and proactively surfaces what
 * the background agency found (the nudge bubble). Clicking it — or saying
 * "Hey Fadi" — expands the conversation. The chat engine is unchanged; the orb
 * only reflects Fadi's live state and hands off seeded questions from ⌘K.
 *
 * It is also the ear. Talking to Fadi and seeing Fadi were two floating controls sitting on top
 * of each other, which is two things to find and one of them redundant. The orb is the presence,
 * so the orb is what you talk to: press it to speak, and open the thread from the label beside
 * it when you want to read rather than listen.
 */
export function FadiOrb({
  tucked = false,
  previewOnly = false,
}: { tucked?: boolean; previewOnly?: boolean } = {}) {
  const {
    open,
    openFadi,
    closeFadi,
    displayState,
    setState,
    seed,
    nudge,
    dismissNudge,
    focus,
    clearFocus,
    guide,
    guideNotice,
    guideTargetCount,
    startGuide,
    stopGuide,
  } = useFadi();
  const launcher = useRef<HTMLDivElement>(null);
  const reducedMotion = useReducedMotion();
  const activeGuide = open || tucked ? null : guide;
  const placement = useOrbGuide(launcher, activeGuide, stopGuide);
  const voice = useVoiceMode();
  const voiceDisplayState: FadiState = voicePhaseToFadiState(voice.phase);

  return (
    <>
      {/* Ambient orb + proactive nudge — hidden while the panel is open. */}
      <motion.div
        ref={launcher}
        data-fadi-launcher
        initial={false}
        animate={{ x: placement?.x ?? 0, y: placement?.y ?? 0 }}
        transition={
          reducedMotion
            ? { duration: 0 }
            : { type: "spring", stiffness: 180, damping: 27, mass: 0.8 }
        }
        style={{ visibility: placement ? "visible" : "hidden", maxWidth: "calc(100vw - 24px)" }}
        inert={open || tucked}
        className={cn(
          "fixed left-0 top-0 z-40 flex flex-col items-end gap-2",
          (open || tucked) && "pointer-events-none opacity-0"
        )}
      >
        {nudge && !activeGuide ? (
          <div className="flex max-w-[16rem] animate-in items-start gap-2 rounded-2xl border border-primary/30 bg-popover/95 p-3 shadow-xl backdrop-blur-xl fade-in slide-in-from-bottom-2">
            <Link href={nudge.href} onClick={dismissNudge} className="group min-w-0 flex-1">
              <p className="text-[0.65rem] font-semibold uppercase tracking-wide text-primary">
                {nudge.label}
              </p>
              <p className="mt-0.5 line-clamp-2 text-sm text-foreground">{nudge.detail}</p>
              <span className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-primary">
                Open
                <ArrowUpRight
                  className="size-3 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
                  aria-hidden="true"
                />
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

        {/* What Fadi just heard and said. Already spoken — this is for whoever can see. */}
        {voice.on && voice.voiceProblem && !activeGuide ? (
          <div className="max-w-[18rem] rounded-lg border border-warning/40 bg-card p-3 text-xs text-warning shadow-lg">
            {voice.voiceProblem}
          </div>
        ) : null}

        {voice.on && (voice.heard || voice.said) && !activeGuide ? (
          <div className="max-w-[18rem] rounded-2xl border border-border/60 bg-popover/95 p-3 text-sm shadow-xl backdrop-blur-xl">
            {voice.heard ? <p className="text-muted-foreground">“{voice.heard}”</p> : null}
            {voice.said ? <p className="mt-1">{voice.said}</p> : null}
          </div>
        ) : null}

        {voice.on && !activeGuide ? (
          <p role="status" className="rounded-full bg-popover/90 px-2.5 py-1 text-xs shadow">
            {VOICE_SESSION_LABEL[voice.phase]}
          </p>
        ) : null}

        <div className="flex items-center gap-2">
          {guideTargetCount > 0 ? (
            <button
              type="button"
              hidden={Boolean(activeGuide)}
              onClick={() => startGuide()}
              className="min-h-9 rounded-full border border-border bg-card px-3 text-xs font-medium shadow-sm focus-visible:outline-2 focus-visible:outline-ring"
            >
              Show me
            </button>
          ) : null}
          {/* Reading rather than listening: the same conversation, in text. */}
          {!activeGuide && !previewOnly ? (
            <button
              type="button"
              onClick={openFadi}
              aria-label="Open the conversation"
              className="flex items-center gap-1.5 rounded-full border border-border/60 bg-popover/90 px-3 py-1.5 text-xs font-medium text-muted-foreground shadow-lg backdrop-blur transition-colors hover:text-foreground"
            >
              <MessageSquare className="size-3.5" aria-hidden="true" />
              Read
            </button>
          ) : null}

          <button
            type="button"
            onClick={previewOnly ? () => startGuide() : voice.toggle}
            aria-pressed={voice.on}
            aria-label={
              previewOnly
                ? "Show me the next control"
                : voice.on
                  ? "Stop listening"
                  : "Talk to Fadi, hands free"
            }
            title={
              previewOnly
                ? "Show me the next control"
                : voice.on
                  ? "Stop listening"
                  : "Talk to Fadi, hands free"
            }
            className="relative grid place-items-center rounded-full"
          >
            <OrbButton state={voice.on ? voiceDisplayState : displayState} />
            <span
              className={cn(
                "pointer-events-none absolute -bottom-1 grid size-6 place-items-center rounded-full border shadow-md transition-colors",
                voice.on
                  ? "border-primary/50 bg-primary text-primary-foreground"
                  : "border-border/60 bg-popover text-muted-foreground"
              )}
            >
              {voice.busy ? (
                <Loader2 className="size-3 animate-spin" aria-hidden="true" />
              ) : voice.on ? (
                <Ear
                  className={cn("size-3", voice.listening && "animate-pulse")}
                  aria-hidden="true"
                />
              ) : (
                <MicOff className="size-3" aria-hidden="true" />
              )}
            </span>
          </button>
        </div>
        {!activeGuide && guideNotice ? (
          <p
            role="status"
            className="max-w-64 rounded-lg border border-border bg-card p-3 text-xs shadow-sm"
          >
            {guideNotice}
          </p>
        ) : null}
      </motion.div>

      {activeGuide && placement?.target && placement.panel ? (
        <>
          <div
            aria-hidden="true"
            data-guide-highlight
            className="pointer-events-none fixed z-30 rounded-lg border-2 border-primary"
            style={{
              left: placement.target.left - 5,
              top: placement.target.top - 5,
              width: placement.target.width + 10,
              height: placement.target.height + 10,
            }}
          />
          <aside
            aria-label="Fadi guidance"
            className="fixed z-40 flex max-h-41 flex-col gap-2 overflow-auto rounded-xl border border-border bg-card p-4 shadow-lg"
            style={{
              left: placement.panel.x,
              top: placement.panel.y,
              width: placement.panel.width,
            }}
          >
            <div role="status" aria-live="polite">
              <p className="text-sm font-semibold">{activeGuide.title}</p>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">
                {activeGuide.description}
              </p>
            </div>
            <button
              autoFocus
              type="button"
              onClick={stopGuide}
              className="min-h-9 self-start rounded-md px-2 text-xs font-medium text-primary hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring"
            >
              Stop guidance <span className="text-muted-foreground">· Esc</span>
            </button>
          </aside>
        </>
      ) : null}

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
                    {FADI_STATE_LABEL[displayState]}
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
            {focus ? (
              <div className="flex shrink-0 items-center gap-2 border-b border-border/60 bg-muted/40 px-4 py-2">
                <span className="text-xs text-muted-foreground">On:</span>
                <span className="min-w-0 flex-1 truncate text-xs font-medium">{focus.title}</span>
                <button
                  onClick={clearFocus}
                  className="rounded-md px-1.5 py-0.5 text-xs text-muted-foreground hover:bg-accent hover:text-foreground"
                >
                  Leave
                </button>
              </div>
            ) : null}
            <div className="min-h-0 flex-1">
              <FadiChat
                key={focus?.workItemId ?? "general"}
                seed={seed}
                onStateChange={setState}
                workItemId={focus?.workItemId ?? null}
              />
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

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
        onClick && "transition-transform hover:scale-105 active:scale-95"
      )}
      data-state={state}
    >
      <FadiCore state={state} size={px} />
    </Wrapper>
  );
}
