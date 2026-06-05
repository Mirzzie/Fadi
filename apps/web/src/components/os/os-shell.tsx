"use client";

import { usePathname } from "next/navigation";

import { Dock } from "./dock";
import { KaiLauncher } from "./kai-launcher";
import { MenuBar } from "./menu-bar";
import { OsModeProvider, useOsMode } from "./os-mode";

/**
 * The OS chrome that wraps every authenticated screen: a top menu bar, a bottom
 * dock, a desktop "wallpaper", and the always-present Kai orb. Pages render in
 * the desktop area between them. Mode (Desk ⇄ Kai) lives in OsModeProvider.
 */
export function OsShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  return (
    <OsModeProvider>
      <div className="relative flex min-h-screen flex-col">
        {/* Wallpaper */}
        <div
          aria-hidden="true"
          className="pointer-events-none fixed inset-0 -z-10 bg-background"
        >
          <div className="absolute inset-0 bg-[radial-gradient(120%_80%_at_50%_-10%,oklch(0.66_0.22_285/0.18),transparent_60%)]" />
          <div className="absolute inset-0 bg-[radial-gradient(90%_60%_at_100%_100%,oklch(0.72_0.19_192/0.12),transparent_55%)]" />
        </div>

        <MenuBar />
        <main className="flex-1 px-3 pb-24 pt-4 sm:px-6">
          {/* Keyed by route so each navigation fades + slides in. */}
          <div
            key={pathname}
            className="duration-300 animate-in fade-in slide-in-from-bottom-2"
          >
            {children}
          </div>
        </main>
        <Dock />
        <DeskOnlyKaiOrb />
      </div>
    </OsModeProvider>
  );
}

/** The corner Kai orb belongs to Desk mode; Kai mode already centres Kai. */
function DeskOnlyKaiOrb() {
  const { mode } = useOsMode();
  return mode === "desk" ? <KaiLauncher /> : null;
}
