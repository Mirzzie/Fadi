"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";
import { areaFor, destinationFor } from "./navigation";

/**
 * Where you are inside a destination, and what else is in it.
 *
 * This is the other half of cutting the dock to four: the areas did not disappear, they moved
 * one level down, where they are a short list with a heading instead of ten peers with none.
 */
export function SubNav() {
  const pathname = usePathname();
  const destination = destinationFor(pathname);
  const current = areaFor(pathname);
  if (!destination || destination.areas.length < 2) return null;

  // On Today the destination and its first area share a name; printing both says "Today Today".
  const showCaption = !destination.areas.some((area) => area.label === destination.label);

  return (
    <nav
      aria-label={`${destination.label} sections`}
      className="mx-auto mb-3 flex max-w-shell flex-wrap items-center gap-x-1 gap-y-1.5"
    >
      {showCaption ? (
        <span className="mr-1 text-xs font-medium text-muted-foreground">{destination.label}</span>
      ) : null}
      {destination.areas.map((area) => {
        const isActive = current?.href === area.href;
        return (
          <Link
            key={area.href}
            href={area.href}
            aria-current={isActive ? "page" : undefined}
            className={cn(
              "rounded-lg px-2.5 py-1 text-sm transition-colors",
              isActive
                ? "bg-muted font-medium text-foreground"
                : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
            )}
          >
            {area.label}
          </Link>
        );
      })}
    </nav>
  );
}
