"use client";

import { LayoutGrid, Mic, MicOff, Monitor, Search, Volume2, VolumeX } from "lucide-react";
import { useEffect, useState } from "react";

import { FadiLogo } from "@/components/brand/fadi-logo";
import { stopFadiSpeech } from "@/lib/voice/fadi-speech";
import { useWakeWord } from "@/lib/voice/use-wake-word";
import { cn } from "@/lib/utils";
import { ActivityCenter } from "./activity-center";
import { summonFadi, useFadi, type FadiState } from "./fadi-presence";
import { useOsMode } from "./os-mode";
import { TrackSwitcher } from "./track-switcher";
import { UserMenu } from "./user-menu";

const VOICE_PREF_KEY = "fadi-voice-enabled";

/** Top menu bar — the OS's persistent identity strip: brand, track, live Fadi
 *  state, the ⌘K spotlight, "Hey Fadi", clock, and the user menu. Fadi is
 *  ambient now, so there's no Desk/Fadi mode toggle. */
export function MenuBar() {
  const { displayState } = useFadi();
  const wake = useWakeWord(summonFadi);
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    setNow(new Date());
    const id = setInterval(() => setNow(new Date()), 1000 * 30);
    return () => clearInterval(id);
  }, []);

  const clock = now
    ? now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    : "··:··";

  return (
    <header className="sticky top-0 z-40 flex h-9 items-center justify-between border-b border-border/60 bg-background/80 px-3 text-xs backdrop-blur-md duration-500 animate-in fade-in slide-in-from-top-2">
      {/* Brand + live Fadi state */}
      <div className="flex items-center gap-2">
        <FadiLogo className="size-5" />
        <span className="font-semibold tracking-tight">FadiOS</span>
        <FadiStateChip state={displayState} />
        <span className="text-muted-foreground/50">/</span>
        <TrackSwitcher />
      </div>

      {/* Spotlight + voice + clock */}
      <div className="flex items-center gap-3">
        {/* ⌘K command spotlight */}
        <button
          type="button"
          onClick={() => window.dispatchEvent(new Event("fadi:command"))}
          title="Search or command (⌘K)"
          className="flex items-center gap-2 rounded-full border border-border/70 bg-muted/40 px-2.5 py-1 font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          <Search className="size-3" aria-hidden="true" />
          <span className="hidden sm:inline">Search</span>
          <kbd className="hidden rounded border border-border/60 bg-background/60 px-1 text-[0.6rem] sm:inline">
            ⌘K
          </kbd>
        </button>

        {/* "Hey Fadi" wake word */}
        {wake.supported ? (
          <button
            type="button"
            onClick={wake.toggle}
            aria-pressed={wake.enabled}
            title={wake.enabled ? 'Listening for "Hey Fadi" — click to stop' : 'Enable "Hey Fadi" voice'}
            className={cn(
              "flex items-center gap-1.5 rounded-full px-2.5 py-1 font-medium transition-colors",
              wake.enabled
                ? "bg-emerald-400/15 text-emerald-300 ring-1 ring-inset ring-emerald-400/30"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {wake.enabled ? (
              <Mic className="size-3 animate-pulse" aria-hidden="true" />
            ) : (
              <MicOff className="size-3" aria-hidden="true" />
            )}
            <span className="hidden sm:inline">Hey Fadi</span>
          </button>
        ) : null}

        <VoiceToggle />
        <ModeToggle />
        <ActivityCenter />
        <span className="tabular-nums text-muted-foreground">{clock}</span>
        <UserMenu />
      </div>
    </header>
  );
}

/** Ambient living shell ⇄ windowed desktop. */
function ModeToggle() {
  const { mode, toggle, ready } = useOsMode();
  if (!ready) return null; // avoid SSR/first-render mismatch on the persisted mode
  const desktop = mode === "desktop";
  return (
    <button
      type="button"
      onClick={toggle}
      aria-pressed={desktop}
      title={desktop ? "Switch to ambient shell" : "Switch to desktop (windows)"}
      className={cn(
        "flex items-center gap-1.5 rounded-full border border-border/70 px-2.5 py-1 font-medium transition-colors",
        desktop ? "bg-primary/15 text-primary ring-1 ring-inset ring-primary/30" : "text-muted-foreground hover:text-foreground",
      )}
    >
      {desktop ? <Monitor className="size-3" aria-hidden="true" /> : <LayoutGrid className="size-3" aria-hidden="true" />}
      <span className="hidden sm:inline">{desktop ? "Desktop" : "Ambient"}</span>
    </button>
  );
}

/** Mute / unmute Fadi's voice (talk-by-default). */
function VoiceToggle() {
  const [on, setOn] = useState<boolean | null>(null);
  useEffect(() => {
    try {
      setOn(localStorage.getItem(VOICE_PREF_KEY) === "1");
    } catch {
      setOn(false);
    }
  }, []);
  if (on === null) return null;
  function toggle() {
    const next = !on;
    setOn(next);
    try {
      localStorage.setItem(VOICE_PREF_KEY, next ? "1" : "0");
    } catch {
      /* ignore */
    }
    if (!next) stopFadiSpeech();
  }
  return (
    <button
      type="button"
      onClick={toggle}
      aria-pressed={Boolean(on)}
      title={on ? "Fadi's voice is on — mute" : "Unmute Fadi's voice"}
      className={cn(
        "grid size-7 place-items-center rounded-full border border-border/70 transition-colors",
        on ? "bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground",
      )}
    >
      {on ? <Volume2 className="size-3.5" aria-hidden="true" /> : <VolumeX className="size-3.5" aria-hidden="true" />}
    </button>
  );
}

const STATE_TEXT: Record<FadiState, string> = {
  idle: "Fadi active",
  listening: "Listening…",
  thinking: "Thinking…",
  working: "Working…",
  speaking: "Speaking…",
};

/** Live status dot + label reflecting Fadi's ambient state. */
function FadiStateChip({ state }: { state: FadiState }) {
  const busy = state !== "idle";
  return (
    <span className="hidden items-center gap-1.5 text-muted-foreground sm:flex">
      <span
        className={cn(
          "size-1.5 rounded-full",
          busy
            ? "bg-primary shadow-[0_0_6px_var(--color-primary)] animate-pulse"
            : "bg-emerald-400 shadow-[0_0_6px_var(--color-emerald-400,#34d399)]",
        )}
      />
      {STATE_TEXT[state]}
    </span>
  );
}
