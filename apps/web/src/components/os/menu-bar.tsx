"use client";

import { Mic, MicOff, Search, Sparkles } from "lucide-react";
import { useEffect, useState } from "react";

import { useWakeWord } from "@/lib/voice/use-wake-word";
import { cn } from "@/lib/utils";
import { ActivityCenter } from "./activity-center";
import { summonScout, useScout, type ScoutState } from "./scout-presence";
import { TrackSwitcher } from "./track-switcher";
import { UserMenu } from "./user-menu";

/** Top menu bar — the OS's persistent identity strip: brand, track, live Scout
 *  state, the ⌘K spotlight, "Hey Scout", clock, and the user menu. Scout is
 *  ambient now, so there's no Desk/Scout mode toggle. */
export function MenuBar() {
  const { state } = useScout();
  const wake = useWakeWord(summonScout);
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
      {/* Brand + live Scout state */}
      <div className="flex items-center gap-2">
        <div className="grid size-5 place-items-center rounded-md bg-gradient-to-br from-primary to-[oklch(0.66_0.22_285)]">
          <Sparkles className="size-3 text-primary-foreground" aria-hidden="true" />
        </div>
        <span className="font-semibold tracking-tight">Career OS</span>
        <ScoutStateChip state={state} />
        <span className="text-muted-foreground/50">/</span>
        <TrackSwitcher />
      </div>

      {/* Spotlight + voice + clock */}
      <div className="flex items-center gap-3">
        {/* ⌘K command spotlight */}
        <button
          type="button"
          onClick={() => window.dispatchEvent(new Event("scout:command"))}
          title="Search or command (⌘K)"
          className="flex items-center gap-2 rounded-full border border-border/70 bg-muted/40 px-2.5 py-1 font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          <Search className="size-3" aria-hidden="true" />
          <span className="hidden sm:inline">Search</span>
          <kbd className="hidden rounded border border-border/60 bg-background/60 px-1 text-[0.6rem] sm:inline">
            ⌘K
          </kbd>
        </button>

        {/* "Hey Scout" wake word */}
        {wake.supported ? (
          <button
            type="button"
            onClick={wake.toggle}
            aria-pressed={wake.enabled}
            title={wake.enabled ? 'Listening for "Hey Scout" — click to stop' : 'Enable "Hey Scout" voice'}
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
            <span className="hidden sm:inline">Hey Scout</span>
          </button>
        ) : null}

        <ActivityCenter />
        <span className="tabular-nums text-muted-foreground">{clock}</span>
        <UserMenu />
      </div>
    </header>
  );
}

const STATE_TEXT: Record<ScoutState, string> = {
  idle: "Scout active",
  listening: "Listening…",
  thinking: "Thinking…",
  working: "Working…",
  speaking: "Speaking…",
};

/** Live status dot + label reflecting Scout's ambient state. */
function ScoutStateChip({ state }: { state: ScoutState }) {
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
