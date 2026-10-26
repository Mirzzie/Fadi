"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown, ChevronUp } from "lucide-react";
import { useEffect, useRef } from "react";

import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { areaFor, DESTINATIONS, destinationFor } from "./navigation";

/**
 * Four destinations in a floating bottom dock. It reserves no layout width and can collapse when
 * the person needs the bottom edge for work.
 *
 * It used to hold ten icons, re-ordered by the career phase, with labels that appeared on
 * hover. Hover is not available on a phone and hover-only text carries no meaning anywhere —
 * so the dock said nothing until you pointed at it, and then said ten things.
 */
export function Dock({ hidden, onHiddenChange }: { hidden: boolean; onHiddenChange: (value: boolean) => void }) {
  const pathname = usePathname();
  const active = destinationFor(pathname);
  const activeArea = areaFor(pathname);
  const toggleRef = useRef<HTMLButtonElement>(null);
  const restoreFocus = useRef(false);
  useEffect(() => {
    if (restoreFocus.current) { toggleRef.current?.focus(); restoreFocus.current = false; }
  }, [hidden]);
  const toggle = (value: boolean) => { restoreFocus.current = true; onHiddenChange(value); };

  if (hidden) {
    return (
      <div className="pointer-events-none fixed inset-x-0 bottom-[max(0.75rem,env(safe-area-inset-bottom))] z-40 flex justify-center">
        <button
          type="button"
          ref={toggleRef}
          onClick={() => toggle(false)}
          aria-label="Show navigation"
          className="fadi-glass pointer-events-auto grid size-9 place-items-center rounded-md border text-muted-foreground hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring"
        >
          <ChevronUp className="size-4" aria-hidden="true" />
        </button>
      </div>
    );
  }

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-[max(0.75rem,env(safe-area-inset-bottom))] z-40 flex justify-center px-2 sm:px-3">
      <nav
        data-fadi-dock
        aria-label="Sections"
        className="fadi-glass pointer-events-auto flex w-full max-w-xl items-stretch justify-around rounded-xl border p-1.5"
      >
        {DESTINATIONS.map((destination) => {
          const isActive = active?.href === destination.href;
          if (isActive) {
            return (
              <DropdownMenu key={`${destination.href}:${pathname}`} modal={false}>
                <DropdownMenuTrigger
                  aria-label={`${destination.label} — choose a view`}
                  className="group flex min-w-0 flex-1 flex-col items-center justify-center gap-1 rounded-md border border-border bg-muted px-1 py-2 text-foreground outline-offset-2 focus-visible:outline-2 focus-visible:outline-ring sm:flex-row sm:gap-2 sm:px-3"
                >
                  <destination.icon className="size-4 shrink-0" aria-hidden="true" />
                  <span className="text-[11px] font-medium sm:text-xs">{destination.label}</span>
                  <ChevronUp
                    className="hidden size-3 shrink-0 group-data-popup-open:rotate-180 sm:block"
                    aria-hidden="true"
                  />
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  side="top"
                  align="center"
                  sideOffset={10}
                  aria-label={`${active.label} views`}
                  className="w-52 max-w-[calc(100vw-1rem)]"
                >
                  {active.areas.map((area) => {
                    const current = activeArea?.href === area.href;
                    return (
                      <DropdownMenuItem
                        key={area.href}
                        render={<Link href={area.href} />}
                        aria-current={current ? "page" : undefined}
                        className={cn(
                          "min-h-10 rounded-md px-3 py-2 text-sm transition-colors",
                          current
                            ? "bg-muted font-medium text-foreground"
                            : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                        )}
                      >
                        {area.label}
                      </DropdownMenuItem>
                    );
                  })}
                </DropdownMenuContent>
              </DropdownMenu>
            );
          }
          return (
            <Link
              key={destination.href}
              href={destination.href}
              className={cn(
                "flex min-w-0 flex-1 flex-col items-center justify-center gap-1 rounded-md border border-transparent px-1 py-2 text-center outline-offset-2 focus-visible:outline-2 focus-visible:outline-ring transition-colors sm:flex-row sm:gap-2 sm:px-3",
                "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
              )}
            >
              <destination.icon className="size-4 shrink-0" aria-hidden="true" />
              <span className="text-[11px] font-medium sm:text-xs">{destination.label}</span>
            </Link>
          );
        })}
        <button
          type="button"
          ref={toggleRef}
          onClick={() => toggle(true)}
          aria-label="Hide navigation"
          title="Hide navigation"
          className="grid w-8 shrink-0 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring"
        >
          <ChevronDown className="size-4" aria-hidden="true" />
        </button>
      </nav>
    </div>
  );
}
