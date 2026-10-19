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
      className="mx-auto mb-5 flex max-w-shell flex-wrap items-center gap-x-5 border-b border-border"
    >
      {showCaption ? (
        <span className="mr-1 pb-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          {destination.label}
        </span>
      ) : null}
      {destination.areas.map((area) => {
        const isActive = current?.href === area.href;
        return (
          <Link
            key={area.href}
            href={area.href}
            aria-current={isActive ? "page" : undefined}
            className={cn(
              "-mb-px border-b-2 px-0.5 pb-2 text-xs transition-colors",
              isActive
                ? "border-primary font-medium text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            {area.label}
          </Link>
        );
      })}
    </nav>
  );
}
