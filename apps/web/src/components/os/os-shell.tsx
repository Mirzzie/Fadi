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

/**
 * The chrome that wraps every authenticated screen: a top menu bar, four-destination rail,
 * calm canvas, a ⌘K spotlight, and the ambient Fadi mentor.
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
  // LAB FOCUS: a project's workspace holds a remote machine. The dock and the floating orb sat
  // on top of its taskbar and terminal (16 Oct 2026); there, navigation is the project's own back
  // link and Fadi opens from its state in the menu bar.
  const labFocus = /^\/dashboard\/learning\/projects\/[0-9a-f-]{36}/.test(pathname);

  return (
    <div className="relative flex min-h-screen flex-col">
      {/* Neutral canvas. Product work supplies the hierarchy; decoration stays out of its way. */}
      <div aria-hidden="true" className="pointer-events-none fixed inset-0 -z-10 bg-background">
        <div className="absolute inset-x-0 top-0 h-64 bg-[linear-gradient(180deg,color-mix(in_oklab,var(--primary)_5%,transparent),transparent)]" />
      </div>

      <MenuBar working={working} />
      <main
        className={`flex-1 px-3 pt-4 sm:px-6 md:pl-[16.5rem] md:pr-8 md:pt-7 ${labFocus ? "pb-4 md:pl-8" : "pb-24 md:pb-12"}`}
      >
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
      {labFocus ? null : <Dock />}
      <CommandBar />
      <FadiOrb tucked={labFocus} />
    </div>
  );
}
