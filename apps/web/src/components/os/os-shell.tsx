"use client";

import { usePathname } from "next/navigation";

import { CareerModeProvider, useCareerMode } from "./career-mode";
import type { CareerMode } from "@/app/dashboard/mode";
import { Dock } from "./dock";
import { FadiOrb } from "./fadi-orb";
import { MenuBar } from "./menu-bar";
import { CommandBar } from "./command-bar";
import { FadiPresenceProvider } from "./fadi-presence";
import { PendingActionsProvider } from "./pending-actions";
import { SubNav } from "./sub-nav";
import { VoiceMode } from "./voice-mode";

/**
 * The chrome that wraps every authenticated screen: a top menu bar, a bottom dock
 * for navigation, a calm background, a ⌘K spotlight, and the ambient Fadi mentor.
 * Deliberately understated — the usefulness is the point, not the UI.
 */
export function OsShell({
  children,
  initialMode,
  activeTrackKey,
  working = null,
}: {
  children: React.ReactNode;
  initialMode: CareerMode;
  /** Id of the active career direction — changes on switch to remount page content. */
  activeTrackKey: string;
  /** The plan Fadi is in the middle of, so the chip can say so on every screen. */
  working?: string | null;
}) {
  return (
    <FadiPresenceProvider>
      {/* Owns the queue of actions waiting on the user, so a decision exists everywhere in
          the app rather than only on the page that happened to ask for it. */}
      <PendingActionsProvider>
        <CareerModeProvider initialMode={initialMode}>
          <OsShellInner activeTrackKey={activeTrackKey} working={working}>
            {children}
          </OsShellInner>
        </CareerModeProvider>
      </PendingActionsProvider>
    </FadiPresenceProvider>
  );
}

function OsShellInner({
  children,
  activeTrackKey,
  working,
}: {
  children: React.ReactNode;
  activeTrackKey: string;
  working: string | null;
}) {
  const pathname = usePathname();
  const { mode } = useCareerMode();

  return (
    <div className="relative flex min-h-screen flex-col">
      {/* Calm background — a single soft wash, no grid/scanlines. */}
      <div aria-hidden="true" className="pointer-events-none fixed inset-0 -z-10 bg-background">
        <div className="absolute inset-0 bg-[radial-gradient(120%_70%_at_50%_-10%,oklch(0.66_0.22_285/0.08),transparent_60%)]" />
      </div>

      <MenuBar working={working} />
      <main className="flex-1 px-3 pb-28 pt-4 sm:px-6">
        <SubNav />
        {/* Keyed by route + active direction + phase. Any of the three changing remounts the
            page so its content follows — client state re-seeds and the switch is felt. The
            transition (fade + a small rise) matches the shell's own dock/menu motion. */}
        <div
          key={`${pathname}:${activeTrackKey}:${mode}`}
          className="duration-300 animate-in fade-in slide-in-from-bottom-1 motion-reduce:animate-none"
        >
          {children}
        </div>
      </main>
      <Dock />
      <CommandBar />
      {/* Hands free: on every authenticated screen, because the session where someone cannot
          look at the screen is not a session where they can go and find the right page first. */}
      <VoiceMode />
      <FadiOrb />
    </div>
  );
}
