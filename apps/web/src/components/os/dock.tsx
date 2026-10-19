"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";
import { DESTINATIONS, destinationFor } from "./navigation";

/**
 * Four destinations. On desktop this is a quiet left rail; on mobile it becomes the bottom bar.
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
        className="pointer-events-auto flex w-full max-w-xl items-stretch justify-around rounded-xl border border-border bg-background/95 p-1.5 shadow-[0_18px_50px_-24px_rgb(0_0_0/0.55)] backdrop-blur-xl duration-300 animate-in fade-in slide-in-from-bottom-2"
      >
        {DESTINATIONS.map((destination) => {
          const isActive = active?.href === destination.href;
          return (
            <Link
              key={destination.href}
              href={destination.href}
              aria-current={isActive ? "page" : undefined}
              className={cn(
                "flex min-w-0 flex-1 items-center justify-center gap-1.5 rounded-md border border-transparent px-2 py-2 text-center transition-colors sm:gap-2 sm:px-4",
                isActive
                  ? "border-border bg-muted text-foreground"
                  : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
              )}
            >
              <destination.icon className={cn("size-4 shrink-0", isActive && "text-primary")} aria-hidden="true" />
              <span className="hidden text-xs font-medium whitespace-nowrap min-[420px]:inline">
                {destination.label}
              </span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
