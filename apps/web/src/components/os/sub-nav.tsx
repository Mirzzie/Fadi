"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";
import { areaFor, destinationFor } from "./navigation";

/**
 * A compact, local switcher for sibling pages inside the current destination.
 *
 * These are content categories, not global product controls, so they sit in the page canvas
 * instead of occupying the persistent menu bar. The dock remains the global wayfinding layer.
 */
export function SubNav() {
  const pathname = usePathname();
  const destination = destinationFor(pathname);
  const current = areaFor(pathname);
  if (!destination || destination.areas.length < 2) return null;

  return (
    <nav
      aria-label={`${destination.label} sections`}
      className="mx-auto mb-5 flex max-w-shell overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
    >
      <div className="inline-flex shrink-0 items-center gap-0.5 rounded-md border border-border bg-muted/25 p-0.5">
        {destination.areas.map((area) => {
          const isActive = current?.href === area.href;
          return (
            <Link
              key={area.href}
              href={area.href}
              aria-current={isActive ? "page" : undefined}
              className={cn(
                "shrink-0 rounded-[4px] px-3 py-1.5 text-xs transition-colors",
                isActive
                  ? "bg-background font-medium text-foreground shadow-sm"
                  : "text-muted-foreground hover:bg-background/60 hover:text-foreground"
              )}
            >
              {area.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
