"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown, ChevronUp } from "lucide-react";
import { useState } from "react";

import { cn } from "@/lib/utils";
import { areaFor, DESTINATIONS, destinationFor } from "./navigation";

/**
 * Four destinations in a floating bottom dock. It reserves no layout width and can collapse when
 * the person needs the bottom edge for work.
 *
 * It used to hold ten icons, re-ordered by the career phase, with labels that appeared on
 * hover. Hover is not available on a phone and hover-only text carries no meaning anywhere —
 * so the dock said nothing until you pointed at it, and then said ten things.
 */
export function Dock() {
  const pathname = usePathname();
  const active = destinationFor(pathname);
  const activeArea = areaFor(pathname);
  const [hidden, setHidden] = useState(false);
  const [sectionsOpen, setSectionsOpen] = useState(false);

  if (hidden) {
    return (
      <div className="pointer-events-none fixed inset-x-0 bottom-3 z-40 flex justify-center">
        <button
          type="button"
          onClick={() => setHidden(false)}
          aria-label="Show navigation"
          className="pointer-events-auto grid size-8 place-items-center rounded-md border border-border bg-background/95 text-muted-foreground shadow-lg backdrop-blur hover:text-foreground"
        >
          <ChevronUp className="size-4" aria-hidden="true" />
        </button>
      </div>
    );
  }

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-3 z-40 flex flex-col items-center gap-2 px-3">
      {sectionsOpen && active ? (
        <nav
          aria-label={`${active.label} views`}
          className="pointer-events-auto flex max-w-[calc(100vw-1.5rem)] gap-1 overflow-x-auto rounded-lg border border-border bg-background/95 p-1 shadow-lg backdrop-blur-xl [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {active.areas.map((area) => {
            const current = activeArea?.href === area.href;
            return (
              <Link
                key={area.href}
                href={area.href}
                onClick={() => setSectionsOpen(false)}
                aria-current={current ? "page" : undefined}
                className={cn(
                  "shrink-0 rounded-md px-3 py-2 text-xs transition-colors",
                  current
                    ? "bg-muted font-medium text-foreground"
                    : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                )}
              >
                {area.label}
              </Link>
            );
          })}
        </nav>
      ) : null}
      <nav
        aria-label="Sections"
        className="pointer-events-auto flex w-full max-w-xl items-stretch justify-around rounded-xl border border-border bg-background/95 p-1.5 shadow-[0_18px_50px_-24px_rgb(0_0_0/0.55)] backdrop-blur-xl duration-300 animate-in fade-in slide-in-from-bottom-2"
      >
        {DESTINATIONS.map((destination) => {
          const isActive = active?.href === destination.href;
          if (isActive) {
            return (
              <button
                key={destination.href}
                type="button"
                onClick={() => setSectionsOpen((open) => !open)}
                aria-expanded={sectionsOpen}
                aria-label={`${destination.label} — choose a view`}
                className="flex min-w-0 flex-1 items-center justify-center gap-1.5 rounded-md border border-border bg-muted px-2 py-2 text-center text-foreground transition-colors hover:bg-muted/80 sm:gap-2 sm:px-4"
              >
                <destination.icon className="size-4 shrink-0 text-primary" aria-hidden="true" />
                <span className="hidden text-xs font-medium whitespace-nowrap min-[420px]:inline">
                  {destination.label}
                </span>
                <ChevronUp
                  className={cn("size-3 shrink-0 transition-transform", sectionsOpen && "rotate-180")}
                  aria-hidden="true"
                />
              </button>
            );
          }
          return (
            <Link
              key={destination.href}
              href={destination.href}
              className={cn(
                "flex min-w-0 flex-1 items-center justify-center gap-1.5 rounded-md border border-transparent px-2 py-2 text-center transition-colors sm:gap-2 sm:px-4",
                "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
              )}
            >
              <destination.icon className="size-4 shrink-0" aria-hidden="true" />
              <span className="hidden text-xs font-medium whitespace-nowrap min-[420px]:inline">
                {destination.label}
              </span>
            </Link>
          );
        })}
        <button
          type="button"
          onClick={() => setHidden(true)}
          aria-label="Hide navigation"
          title="Hide navigation"
          className="grid w-8 shrink-0 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <ChevronDown className="size-4" aria-hidden="true" />
        </button>
      </nav>
    </div>
  );
}
