"use client";

import {
  BriefcaseBusiness,
  Compass,
  Globe,
  GraduationCap,
  KanbanSquare,
  Layers,
  LayoutDashboard,
  MessageSquareQuote,
  Settings,
  UserRoundCog,
  Users,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Fragment } from "react";

import { cn } from "@/lib/utils";
import { useCareerMode } from "./career-mode";
import type { CareerMode } from "@/app/dashboard/mode-actions";

/** Groups order the dock by the career journey so co-dependent surfaces sit
 *  together: Start → Orient → You → Pursue → Prepare → System. */
type DockGroup = "start" | "orient" | "you" | "pursue" | "prepare" | "system";
export type DockApp = { href: string; label: string; icon: LucideIcon; group: DockGroup };

export const DOCK_APPS: DockApp[] = [
  // Start
  { href: "/dashboard", label: "Home", icon: LayoutDashboard, group: "start" },
  // Orient — where to aim, and what the world is doing
  { href: "/dashboard/niche-finder", label: "Niche Finder", icon: Compass, group: "orient" },
  // You — who you are + what you send
  { href: "/dashboard/evidence", label: "Evidence", icon: Layers, group: "you" },
  { href: "/dashboard/portfolio", label: "Portfolio", icon: Globe, group: "you" },
  // Pursue — the pipeline
  { href: "/dashboard/jobs", label: "Jobs", icon: BriefcaseBusiness, group: "pursue" },
  { href: "/dashboard/applications", label: "Applications", icon: KanbanSquare, group: "pursue" },
  { href: "/dashboard/network", label: "Network", icon: Users, group: "pursue" },
  // Prepare & grow
  { href: "/dashboard/interview", label: "Interview", icon: MessageSquareQuote, group: "prepare" },
  { href: "/dashboard/learning", label: "Learning", icon: GraduationCap, group: "prepare" },
  // System
  { href: "/dashboard/profile", label: "Profile", icon: UserRoundCog, group: "system" },
  { href: "/dashboard/settings", label: "Settings", icon: Settings, group: "system" },
];

// The mode transforms the whole shell: Apply drops the build tools (Niche/Interview/Learning),
// Prepare drops the pipeline (Jobs/Applications/Network). Shared groups (Home, You, System) stay.
const APPLY_HIDES = new Set<DockGroup>(["orient", "prepare"]);
const PREPARE_HIDES = new Set<DockGroup>(["pursue"]);

function appsForMode(mode: CareerMode): DockApp[] {
  const hidden = mode === "apply" ? APPLY_HIDES : PREPARE_HIDES;
  return DOCK_APPS.filter((a) => !hidden.has(a.group));
}

/** The OS dock — navigation, transformed by the current career phase. */
export function Dock() {
  const pathname = usePathname();
  const { mode } = useCareerMode();
  const apps = appsForMode(mode);

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-3 z-40 flex justify-center px-3">
      <nav
        aria-label="Apps"
        className="glass-holo pointer-events-auto flex items-end gap-1.5 rounded-2xl px-2.5 py-2 duration-500 animate-in fade-in slide-in-from-bottom-4"
      >
        {apps.map((app, i) => {
          const newGroup = i > 0 && app.group !== apps[i - 1].group;
          const active =
            app.href === "/dashboard" ? pathname === "/dashboard" : pathname.startsWith(app.href);
          return (
            <Fragment key={app.href}>
              {newGroup ? (
                <span className="mx-1 h-7 w-px self-center bg-border/60" aria-hidden="true" />
              ) : null}
              <Link
                href={app.href}
                title={app.label}
                aria-label={app.label}
                className="group relative grid size-11 place-items-center rounded-xl transition-transform duration-150 hover:-translate-y-1.5"
              >
                <span
                  className={cn(
                    "grid size-11 place-items-center rounded-xl border transition-colors",
                    active
                      ? "border-primary/40 bg-gradient-to-br from-primary/25 to-[oklch(0.66_0.22_285)]/20 text-primary"
                      : "border-border/60 bg-muted/50 text-muted-foreground group-hover:text-foreground"
                  )}
                >
                  <app.icon className="size-5" aria-hidden="true" />
                </span>
                <span
                  className={cn(
                    "absolute -bottom-0.5 size-1 rounded-full bg-primary transition-opacity",
                    active ? "opacity-100" : "opacity-0"
                  )}
                />
                <span className="pointer-events-none absolute -top-8 scale-90 rounded-md border border-border/60 bg-popover px-2 py-0.5 text-xs font-medium opacity-0 shadow-md transition-all group-hover:scale-100 group-hover:opacity-100">
                  {app.label}
                </span>
              </Link>
            </Fragment>
          );
        })}
      </nav>
    </div>
  );
}
