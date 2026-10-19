"use client";

import { Sparkles, Square, Volume2 } from "lucide-react";
import { useEffect, useRef, useSyncExternalStore } from "react";

import type { Briefing } from "@/lib/agents/briefing";
import { useSpeechOutput } from "@/lib/voice/use-speech-output";
import { cn } from "@/lib/utils";

const VOICE_PREF_KEY = "fadi-voice-enabled";

/**
 * Fadi's proactive open: the briefing he greets you with on the dashboard. Shows
 * the (real, never fabricated) items and lets Fadi read it aloud in his male voice.
 * Auto-speaks once when the user keeps voice on; browsers gate audio on a gesture,
 * so the "Hear from Fadi" button is the explicit unlock.
 */
export function FadiBriefing({ briefing }: { briefing: Briefing }) {
  const { speak, stop, state, isSupported } = useSpeechOutput({ rate: 1.0 });
  const mounted = useSyncExternalStore(() => () => {}, () => true, () => false);
  const tried = useRef(false);

  useEffect(() => {
    if (!mounted || !isSupported || tried.current) return;
    tried.current = true;
    if (localStorage.getItem(VOICE_PREF_KEY) === "1") speak(briefing.spoken);
  }, [mounted, isSupported, speak, briefing.spoken]);

  const speaking = state === "speaking";

  function toggle() {
    if (speaking) {
      stop();
      return;
    }
    localStorage.setItem(VOICE_PREF_KEY, "1"); // remember they want Fadi's voice
    speak(briefing.spoken);
  }

  return (
    <section className="border-y border-border bg-card py-4 sm:py-5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span className="grid size-8 shrink-0 place-items-center rounded-md border border-border bg-muted text-foreground">
            <Sparkles className="size-4" aria-hidden="true" />
          </span>
          <div>
            <p className="text-sm font-semibold tracking-tight">Fadi&apos;s briefing</p>
            <p className="text-xs text-muted-foreground">What I&apos;ve lined up for you</p>
          </div>
        </div>
        {mounted && isSupported ? (
          <button
            type="button"
            onClick={toggle}
            aria-pressed={speaking}
            className={cn(
              "flex shrink-0 items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-medium transition-colors",
              speaking
                ? "border-primary/40 bg-primary/10 text-primary"
                : "border-border/60 text-muted-foreground hover:text-foreground",
            )}
          >
            {speaking ? (
              <Square className="size-3.5" aria-hidden="true" />
            ) : (
              <Volume2 className="size-3.5" aria-hidden="true" />
            )}
            {speaking ? "Stop" : "Hear from Fadi"}
          </button>
        ) : null}
      </div>

      {/* Just the spoken open. The actionable items live once, in the Mission Control hero
          below — the briefing used to repeat them as tiles, doubling the top of the page. */}
      <p className="mt-3 text-sm leading-relaxed text-foreground/90">{briefing.text}</p>
    </section>
  );
}
