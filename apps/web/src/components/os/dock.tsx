"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { FadiLogo } from "@/components/brand/fadi-logo";
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
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-40 flex justify-center md:inset-y-0 md:left-0 md:right-auto md:w-50 md:justify-start">
      <nav
        aria-label="Sections"
        className="pointer-events-auto flex w-full items-stretch justify-around border-t border-border bg-background/95 px-2 py-2 backdrop-blur-xl duration-300 animate-in fade-in slide-in-from-bottom-2 md:flex-col md:justify-start md:border-r md:border-t-0 md:bg-background md:px-3 md:py-0 md:backdrop-blur-none md:slide-in-from-bottom-0 md:slide-in-from-left-2"
      >
        <Link
          href="/dashboard"
          aria-label="Fadi home"
          className="hidden h-12 items-center gap-2 border-b border-border px-2 md:flex"
        >
          <FadiLogo className="size-5" />
          <span className="font-heading text-sm font-semibold tracking-tight">Fadi</span>
        </Link>
        <div className="hidden py-3 md:block">
        {DESTINATIONS.map((destination) => {
          const isActive = active?.href === destination.href;
          return (
            <Link
              key={destination.href}
              href={destination.href}
              aria-current={isActive ? "page" : undefined}
              className={cn(
                "flex min-w-0 flex-col items-center gap-1 border-l-2 border-transparent px-2 py-1.5 text-center transition-colors md:flex-row md:gap-2.5 md:px-2.5 md:py-2 md:text-left",
                isActive
                  ? "border-l-foreground bg-muted/70 text-foreground"
                  : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
              )}
            >
              <destination.icon className={cn("size-4 shrink-0", isActive && "text-primary")} aria-hidden="true" />
              <span className="text-[11px] font-medium whitespace-nowrap md:text-sm">
                {destination.label}
              </span>
            </Link>
          );
        })}
        </div>
        <div className="contents md:hidden">
          {DESTINATIONS.map((destination) => {
            const isActive = active?.href === destination.href;
            return (
              <Link
                key={destination.href}
                href={destination.href}
                aria-current={isActive ? "page" : undefined}
                className={cn(
                  "flex min-w-0 flex-col items-center gap-1 border-t-2 border-transparent px-2 py-1 text-center transition-colors",
                  isActive ? "border-t-foreground text-foreground" : "text-muted-foreground",
                )}
              >
                <destination.icon className="size-4 shrink-0" aria-hidden="true" />
                <span className="text-[10px] font-medium whitespace-nowrap">{destination.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
