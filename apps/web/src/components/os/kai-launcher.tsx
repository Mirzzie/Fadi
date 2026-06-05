"use client";

import { Sparkles, X } from "lucide-react";

import { KaiChat } from "@/components/kai/kai-chat";
import { cn } from "@/lib/utils";
import { useOsMode } from "./os-mode";

/**
 * The always-present Kai orb (Desk mode). Floats above the dock; clicking it —
 * or saying "Hey Kai" — slides Kai out from the right so the user can talk to
 * their agent from any app. Open-state lives in OsMode context so the wake word
 * can summon it. In Kai mode the orb is hidden (Kai is already the centrepiece).
 */
export function KaiLauncher() {
  const { kaiOpen, openKai, closeKai, kaiVoiceNonce } = useOsMode();
  const open = kaiOpen;

  return (
    <>
      {/* Orb */}
      <button
        type="button"
        onClick={openKai}
        aria-label="Open Kai"
        className={cn(
          "group fixed bottom-20 right-5 z-40 grid size-14 place-items-center rounded-full",
          "bg-gradient-to-br from-primary to-[oklch(0.66_0.22_285)] shadow-xl",
          "ring-2 ring-primary/30 transition-transform hover:scale-105 active:scale-95",
          open && "pointer-events-none opacity-0",
        )}
      >
        <span className="absolute inset-0 animate-ping rounded-full bg-primary/30 [animation-duration:3s]" />
        <Sparkles className="size-6 text-primary-foreground" aria-hidden="true" />
      </button>

      {/* Slide-over panel */}
      {open ? (
        <div className="fixed inset-0 z-50">
          <button
            aria-label="Close Kai"
            onClick={closeKai}
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
          />
          <div className="absolute inset-y-0 right-0 flex w-full max-w-md flex-col border-l border-border/60 bg-card shadow-2xl">
            <div className="flex h-12 shrink-0 items-center justify-between border-b border-border/60 px-4">
              <div className="flex items-center gap-2">
                <div className="grid size-6 place-items-center rounded-md bg-gradient-to-br from-primary to-[oklch(0.66_0.22_285)]">
                  <Sparkles className="size-3.5 text-primary-foreground" aria-hidden="true" />
                </div>
                <span className="text-sm font-semibold">Kai</span>
              </div>
              <button
                onClick={closeKai}
                aria-label="Close"
                className="grid size-7 place-items-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
              >
                <X className="size-4" aria-hidden="true" />
              </button>
            </div>
            <div className="min-h-0 flex-1">
              <KaiChat autoListenNonce={kaiVoiceNonce} />
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
