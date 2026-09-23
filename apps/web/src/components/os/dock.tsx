"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";
import { DESTINATIONS, destinationFor } from "./navigation";

/**
 * The dock: four destinations, each with its label visible at every size.
 *
 * It used to hold ten icons, re-ordered by the career phase, with labels that appeared on
 * hover. Hover is not available on a phone and hover-only text carries no meaning anywhere —
 * so the dock said nothing until you pointed at it, and then said ten things.
 */
export function Dock() {
  const pathname = usePathname();
  const active = destinationFor(pathname);

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-3 z-40 flex justify-center px-3">
      <nav
        aria-label="Sections"
        className="glass-holo pointer-events-auto flex items-stretch gap-1 rounded-2xl p-1.5 duration-500 animate-in fade-in slide-in-from-bottom-4"
      >
        {DESTINATIONS.map((destination) => {
          const isActive = active?.href === destination.href;
          return (
            <Link
              key={destination.href}
              href={destination.href}
              aria-current={isActive ? "page" : undefined}
              className={cn(
                "flex min-w-0 flex-col items-center gap-0.5 rounded-xl border px-3 py-1.5 text-center transition-colors sm:flex-row sm:gap-2 sm:px-3.5 sm:py-2",
                isActive
                  ? "border-primary/40 bg-gradient-to-br from-primary/25 to-[oklch(0.66_0.22_285)]/20 text-primary"
                  : "border-transparent text-muted-foreground hover:bg-muted/50 hover:text-foreground"
              )}
            >
              <destination.icon className="size-5 shrink-0" aria-hidden="true" />
              <span className="text-xs font-medium whitespace-nowrap sm:text-sm">
                {destination.label}
              </span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
