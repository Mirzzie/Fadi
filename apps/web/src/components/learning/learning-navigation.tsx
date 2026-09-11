"use client";

import Link from "next/link";
import {
  History, BookOpen, Boxes, MonitorCog } from "lucide-react";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

const destinations = [
  {
    href: "/dashboard/learning",
    label: "Overview",
    icon: BookOpen,
    exact: true,
  },
  {
    href: "/dashboard/learning/projects",
    label: "Projects",
    icon: Boxes,
  },
  {
    href: "/dashboard/learning/machines",
    label: "Machines",
    icon: MonitorCog,
  },
  {
    href: "/dashboard/learning/activity",
    label: "Activity",
    icon: History,
  },
];

/** The Learning Hub has three jobs. Keeping them visible prevents machine control,
 * project work and career planning from collapsing back into one long dashboard. */
export function LearningNavigation() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Learning Hub"
      className="flex w-fit max-w-full gap-1 overflow-x-auto rounded-xl border border-border/70 bg-card/80 p-1 shadow-sm"
    >
      {destinations.map(({ href, label, icon: Icon, exact }) => {
        const active = exact ? pathname === href : pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg px-3 text-sm font-medium transition-colors",
              active
                ? "bg-primary/12 text-primary shadow-sm"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            )}
          >
            <Icon className="size-3.5" aria-hidden="true" />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
