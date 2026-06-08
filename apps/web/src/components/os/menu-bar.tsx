"use client";

import { LayoutGrid, Mic, MicOff, Sparkles } from "lucide-react";
import { useEffect, useState } from "react";

import { useWakeWord } from "@/lib/voice/use-wake-word";
import { cn } from "@/lib/utils";
import { summonKai, useOsMode } from "./os-mode";
import { TrackSwitcher } from "./track-switcher";
import { UserMenu } from "./user-menu";

/** Top menu bar — the OS's persistent identity strip: brand, live clock, Kai
 *  status, and the Desk ⇄ Kai mode switch. */
export function MenuBar() {
  const { mode, setMode } = useOsMode();
  const wake = useWakeWord(summonKai);
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
      {/* Brand */}
      <div className="flex items-center gap-2">
        <div className="grid size-5 place-items-center rounded-md bg-gradient-to-br from-primary to-[oklch(0.66_0.22_285)]">
          <Sparkles className="size-3 text-primary-foreground" aria-hidden="true" />
        </div>
        <span className="font-semibold tracking-tight">Career OS</span>
        <span className="hidden items-center gap-1.5 text-muted-foreground sm:flex">
          <span className="size-1.5 rounded-full bg-emerald-400 shadow-[0_0_6px_var(--color-emerald-400,#34d399)]" />
          Kai active
        </span>
        <span className="text-muted-foreground/50">/</span>
        <TrackSwitcher />
      </div>

      {/* Mode switch + clock */}
      <div className="flex items-center gap-3">
        {/* "Hey Kai" wake word */}
        {wake.supported ? (
          <button
            type="button"
            onClick={wake.toggle}
            aria-pressed={wake.enabled}
            title={wake.enabled ? 'Listening for "Hey Kai" — click to stop' : 'Enable "Hey Kai" voice'}
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
            <span className="hidden sm:inline">Hey Kai</span>
          </button>
        ) : null}

        <div className="flex items-center rounded-full border border-border/70 bg-muted/40 p-0.5">
          <ModeButton active={mode === "desk"} onClick={() => setMode("desk")} icon={<LayoutGrid className="size-3" />}>
            Desk
          </ModeButton>
          <ModeButton active={mode === "kai"} onClick={() => setMode("kai")} icon={<Sparkles className="size-3" />}>
            Kai
          </ModeButton>
        </div>
        <span className="tabular-nums text-muted-foreground">{clock}</span>
        <UserMenu />
      </div>
    </header>
  );
}

function ModeButton({
  active,
  onClick,
  icon,
  children,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "flex items-center gap-1 rounded-full px-2.5 py-1 font-medium transition-colors",
        active
          ? "bg-primary/15 text-primary ring-1 ring-inset ring-primary/30"
          : "text-muted-foreground hover:text-foreground",
      )}
    >
      {icon}
      {children}
    </button>
  );
}
