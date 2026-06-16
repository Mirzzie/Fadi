"use client";

import { usePathname, useSearchParams } from "next/navigation";

import { BootSequence } from "./boot-sequence";
import { Desktop } from "./desktop";
import { Dock } from "./dock";
import { FadiOrb } from "./fadi-orb";
import { MenuBar } from "./menu-bar";
import { CommandBar } from "./command-bar";
import { FadiPresenceProvider } from "./fadi-presence";
import { OsModeProvider, useOsMode } from "./os-mode";
import { WindowManagerProvider } from "./window-manager";

/**
 * The FadiOS chrome that wraps every authenticated screen: a top menu bar, a
 * bottom dock, a living holographic wallpaper, a ⌘K spotlight, the ambient Fadi
 * orb, and a cinematic wake. It runs in two switchable faces — an **ambient**
 * shell (your route screens) and a windowed **desktop** — and Fadi is everywhere.
 */
export function OsShell({ children }: { children: React.ReactNode }) {
  return (
    <FadiPresenceProvider>
      <OsModeProvider>
        <WindowManagerProvider>
          <OsShellInner>{children}</OsShellInner>
        </WindowManagerProvider>
      </OsModeProvider>
    </FadiPresenceProvider>
  );
}

function OsShellInner({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { mode } = useOsMode();
  // When a route is embedded inside a desktop window (?os=window), drop the OS
  // chrome so there's no nested menu-bar/dock/orb — just the app's content.
  const chromeless = useSearchParams().get("os") === "window";

  if (chromeless) {
    return (
      <div className="min-h-screen bg-background">
        <main className="px-3 py-4 sm:px-5">{children}</main>
      </div>
    );
  }

  return (
    <div className="relative flex min-h-screen flex-col">
      {/* Living holographic wallpaper */}
      <div aria-hidden="true" className="pointer-events-none fixed inset-0 -z-10 bg-background">
        <div className="absolute inset-0 bg-[radial-gradient(120%_80%_at_50%_-10%,oklch(0.66_0.22_285/0.18),transparent_60%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(90%_60%_at_100%_100%,oklch(0.72_0.19_192/0.12),transparent_55%)]" />
        <div className="holo-grid absolute inset-0 opacity-60" />
        <div className="holo-scanlines absolute inset-0 opacity-40" />
      </div>

      <MenuBar />
      <main className="flex-1 px-3 pb-24 pt-4 sm:px-6">
        {mode === "desktop" ? (
          <Desktop />
        ) : (
          // Keyed by route so each navigation fades + slides in.
          <div key={pathname} className="duration-300 animate-in fade-in slide-in-from-bottom-2">
            {children}
          </div>
        )}
      </main>
      <Dock />
      <CommandBar />
      <FadiOrb />
      <BootSequence />
    </div>
  );
}
