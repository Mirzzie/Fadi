"use client";

import { usePathname } from "next/navigation";

import { CareerModeProvider, useCareerMode } from "./career-mode";
import type { CareerMode } from "@/app/dashboard/mode";
import { Dock } from "./dock";
import { FadiOrb } from "./fadi-orb";
import { MenuBar } from "./menu-bar";
import { CommandBar } from "./command-bar";
import { FadiPresenceProvider } from "./fadi-presence";

/**
 * The chrome that wraps every authenticated screen: a top menu bar, a bottom dock
 * for navigation, a calm background, a ⌘K spotlight, and the ambient Fadi mentor.
 * Deliberately understated — the usefulness is the point, not the UI.
 */
export function OsShell({
  children,
  initialMode,
  activeTrackKey,
}: {
  children: React.ReactNode;
  initialMode: CareerMode;
  /** Id of the active career direction — changes on switch to remount page content. */
  activeTrackKey: string;
}) {
  return (
    <FadiPresenceProvider>
      <CareerModeProvider initialMode={initialMode}>
        <OsShellInner activeTrackKey={activeTrackKey}>{children}</OsShellInner>
      </CareerModeProvider>
    </FadiPresenceProvider>
  );
}

function OsShellInner({
  children,
  activeTrackKey,
}: {
  children: React.ReactNode;
  activeTrackKey: string;
}) {
  const pathname = usePathname();
  const { mode } = useCareerMode();

  return (
    <div className="relative flex min-h-screen flex-col">
      {/* Calm background — a single soft wash, no grid/scanlines. */}
      <div aria-hidden="true" className="pointer-events-none fixed inset-0 -z-10 bg-background">
        <div className="absolute inset-0 bg-[radial-gradient(120%_70%_at_50%_-10%,oklch(0.66_0.22_285/0.08),transparent_60%)]" />
      </div>

      <MenuBar />
      <main className="flex-1 px-3 pb-24 pt-4 sm:px-6">
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
      <FadiOrb />
    </div>
  );
}
