"use client";

import { Bell, MessageSquare, StickyNote } from "lucide-react";

import { FadiCore } from "./fadi-core";
import { useFadi } from "./fadi-presence";
import { WindowLayer } from "./window";
import { useWindows, type WindowApp } from "./window-manager";

const APPS: Array<{ app: WindowApp; label: string; icon: typeof Bell }> = [
  { app: "fadi", label: "Fadi", icon: MessageSquare },
  { app: "activity", label: "Activity", icon: Bell },
  { app: "notes", label: "Notes", icon: StickyNote },
];

/**
 * The desktop face of FadiOS: a living Fadi core centerpiece + an app launcher,
 * with draggable holographic windows on top. Shown when the OS is in "desktop"
 * mode (toggled from the menu bar).
 */
export function Desktop() {
  const { state } = useFadi();
  const { open } = useWindows();

  return (
    <div className="relative h-[calc(100vh-8.5rem)] w-full overflow-hidden">
      {/* Centerpiece — pointer-events pass through to windows except the controls */}
      <div className="pointer-events-none absolute inset-0 grid place-items-center">
        <div className="pointer-events-auto flex flex-col items-center gap-6 text-center">
          <FadiCore state={state} size={168} />
          <div>
            <h1 className="text-glow text-xl font-semibold tracking-tight">FadiOS Desktop</h1>
            <p className="mt-1 text-sm text-muted-foreground">Open an app, or just talk to Fadi.</p>
          </div>
          <div className="flex gap-3">
            {APPS.map(({ app, label, icon: Icon }) => (
              <button
                key={app}
                type="button"
                onClick={() => open(app)}
                className="glass-holo group flex w-[5.5rem] flex-col items-center gap-2 rounded-2xl p-3 transition-transform hover:-translate-y-1"
              >
                <Icon className="size-6 text-primary transition-transform group-hover:scale-110" aria-hidden="true" />
                <span className="text-xs font-medium">{label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      <WindowLayer />
    </div>
  );
}
