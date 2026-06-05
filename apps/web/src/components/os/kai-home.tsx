"use client";

import { ArrowUpRight } from "lucide-react";
import Link from "next/link";

import { KaiChat } from "@/components/kai/kai-chat";
import { useOsMode } from "./os-mode";

export type KaiOpportunity = { label: string; detail: string; href: string };

/**
 * Kai-mode home (Option 3): Kai is the centrepiece. A living core greets the
 * user, surfaces real opportunities, and the conversation happens right here —
 * the assistant-first face of the OS. Reuses the same Kai engine (KaiChat).
 */
export function KaiHome({
  greeting,
  subline,
  opportunities = [],
}: {
  greeting: string;
  subline?: string;
  opportunities?: KaiOpportunity[];
}) {
  const { kaiVoiceNonce } = useOsMode();
  return (
    <div className="mx-auto flex h-[calc(100vh-9rem)] max-w-3xl flex-col items-center">
      {/* Living Kai core */}
      <div className="relative mt-2 grid place-items-center">
        <div className="absolute size-40 animate-ping rounded-full bg-primary/15 [animation-duration:4s]" />
        <div className="absolute size-28 rounded-full bg-primary/20 blur-2xl" />
        <div className="relative grid size-20 place-items-center rounded-full bg-gradient-to-br from-primary to-[oklch(0.66_0.22_285)] shadow-2xl ring-4 ring-primary/20">
          <div className="size-8 animate-pulse rounded-full bg-primary-foreground/90 [animation-duration:2.5s]" />
        </div>
      </div>

      <div className="mt-5 text-center">
        <h1 className="text-balance text-2xl font-semibold tracking-tight">{greeting}</h1>
        {subline ? (
          <p className="mx-auto mt-2 max-w-md text-balance text-sm text-muted-foreground">{subline}</p>
        ) : null}
      </div>

      {/* Live opportunities Kai has lined up */}
      {opportunities.length > 0 ? (
        <div className="mt-5 grid w-full gap-2 sm:grid-cols-3">
          {opportunities.map((opp, i) => (
            <Link
              key={`${opp.label}-${opp.detail}-${i}`}
              href={opp.href}
              className="group rounded-xl border border-border/60 bg-card/60 p-3 text-left backdrop-blur transition-colors hover:border-primary/40"
            >
              <div className="flex items-start justify-between gap-2">
                <p className="text-xs font-medium uppercase tracking-wide text-primary">{opp.label}</p>
                <ArrowUpRight className="size-3.5 shrink-0 text-muted-foreground transition-colors group-hover:text-primary" aria-hidden="true" />
              </div>
              <p className="mt-1 line-clamp-2 text-sm text-foreground">{opp.detail}</p>
            </Link>
          ))}
        </div>
      ) : null}

      {/* Conversation */}
      <div className="kai-glow-sm mt-5 min-h-0 w-full flex-1 overflow-hidden rounded-2xl border border-border/60 bg-card/70 backdrop-blur">
        <KaiChat autoListenNonce={kaiVoiceNonce} />
      </div>
    </div>
  );
}
