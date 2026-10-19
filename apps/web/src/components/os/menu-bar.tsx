"use client";

import { Search } from "lucide-react";

import { FadiLogo } from "@/components/brand/fadi-logo";
import { FADI_STATE_LABEL } from "@/lib/agent/state";
import { cn } from "@/lib/utils";
import { ActivityCenter } from "./activity-center";
import { ApprovalCenter } from "./approval-center";
import { useFadi, type FadiState } from "./fadi-presence";
import { TrackSwitcher } from "./track-switcher";
import { UserMenu } from "./user-menu";

/** Top menu bar — the OS's persistent identity strip: brand, track, live Fadi
 *  state, the ⌘K spotlight, "Hey Fadi", clock, and the user menu. Fadi is
 *  ambient now, so there's no Desk/Fadi mode toggle. */
export function MenuBar({ working = null }: { working?: string | null } = {}) {
  const { displayState } = useFadi();
  return (
    <header className="sticky top-0 z-40 flex h-12 items-center justify-between border-b border-border bg-background/95 px-3 text-xs backdrop-blur-md duration-300 animate-in fade-in slide-in-from-top-2">
      {/* Brand + live Fadi state */}
      <div className="flex items-center gap-2">
        <FadiLogo className="size-5" />
        <span className="font-semibold tracking-tight">Fadi</span>
        <FadiStateChip state={displayState} working={working} />
        <span className="text-muted-foreground/50">/</span>
        <TrackSwitcher />
      </div>

      {/* Work controls only. Voice lives on the Fadi control; time lives in the OS. */}
      <div className="flex items-center gap-2">
        {/* ⌘K command spotlight */}
        <button
          type="button"
          onClick={() => window.dispatchEvent(new Event("fadi:command"))}
          title="Search or command (⌘K)"
          className="flex h-7 items-center gap-2 border border-border bg-muted/30 px-2 font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <Search className="size-3" aria-hidden="true" />
          <span className="hidden sm:inline">Search</span>
          <kbd className="hidden border border-border bg-background px-1 text-[0.6rem] sm:inline">
            ⌘K
          </kbd>
        </button>

        {/* Decisions before notifications. The approval queue sits to the LEFT of the bell
            because it blocks and the bell does not, and it is absent entirely when nothing
            is waiting rather than showing a zero. */}
        <ApprovalCenter />
        <ActivityCenter />
        <UserMenu />
      </div>
    </header>
  );
}

/** Live status dot + label reflecting Fadi's ambient state. */
function FadiStateChip({ state, working }: { state: FadiState; working: string | null }) {
  const busy = !["ready", "offline"].includes(state);
  const { openFadi } = useFadi();
  // The state is also the way in: in lab focus the floating orb steps aside, so Fadi opens here.
  return (
    <button
      type="button"
      onClick={() => openFadi()}
      title="Talk to Fadi"
      className="hidden items-center gap-1.5 rounded-md px-1 text-muted-foreground hover:text-foreground sm:flex"
    >
      <span
        className={cn(
          "size-1.5 rounded-full",
          state === "offline"
            ? "bg-muted-foreground"
            : state === "blocked"
              ? "bg-destructive shadow-[0_0_6px_var(--color-destructive)]"
              : state === "waiting_for_approval"
                ? "bg-amber-400 shadow-[0_0_6px_var(--color-amber-400,#fbbf24)] animate-pulse"
                : busy
                  ? "bg-primary shadow-[0_0_6px_var(--color-primary)] animate-pulse"
                  : "bg-emerald-400 shadow-[0_0_6px_var(--color-emerald-400,#34d399)]"
        )}
      />
      {/* What it is doing beats what it is. "Fadi active" on every screen of a product that
          runs plans is a light that is always on. */}
      <span className="max-w-[16rem] truncate">
        {state === "ready" && working ? `On: ${working}` : `Fadi ${FADI_STATE_LABEL[state].toLowerCase()}`}
      </span>
    </button>
  );
}
