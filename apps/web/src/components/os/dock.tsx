"use client";

import {
  BriefcaseBusiness,
  Compass,
  FileText,
  GraduationCap,
  CloudSun,
  KanbanSquare,
  LayoutDashboard,
  MessageSquareQuote,
  Settings,
  Sparkles,
  UserRoundCog,
  Users,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";
import { useOsMode } from "./os-mode";
import { useWindows, type WindowApp } from "./window-manager";

export type DockApp = { href: string; label: string; icon: LucideIcon; app: WindowApp };

export const DOCK_APPS: DockApp[] = [
  { href: "/dashboard", label: "Home", icon: LayoutDashboard, app: "home" },
  { href: "/dashboard/jobs", label: "Jobs", icon: BriefcaseBusiness, app: "jobs" },
  { href: "/dashboard/niche-finder", label: "Niche Finder", icon: Compass, app: "niche" },
  { href: "/dashboard/applications", label: "Applications", icon: KanbanSquare, app: "applications" },
  { href: "/dashboard/network", label: "Network", icon: Users, app: "network" },
  { href: "/dashboard/interview", label: "Interview", icon: MessageSquareQuote, app: "interview" },
  { href: "/dashboard/intelligence", label: "Career Weather", icon: CloudSun, app: "intelligence" },
  { href: "/dashboard/documents", label: "Documents", icon: FileText, app: "documents" },
  { href: "/dashboard/learning", label: "Learning", icon: GraduationCap, app: "learning" },
  { href: "/dashboard/fadi", label: "Fadi", icon: Sparkles, app: "fadi" },
  { href: "/dashboard/profile", label: "Profile", icon: UserRoundCog, app: "profile" },
  { href: "/dashboard/settings", label: "Settings", icon: Settings, app: "settings" },
];

/** The OS dock — in ambient mode it navigates; in desktop mode it opens windows. */
export function Dock() {
  const pathname = usePathname();
  const { mode } = useOsMode();
  const { open } = useWindows();
  const desktop = mode === "desktop";

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-3 z-40 flex justify-center px-3">
      <nav
        aria-label="Apps"
        className="glass-holo pointer-events-auto flex items-end gap-1.5 rounded-2xl px-2.5 py-2 duration-500 animate-in fade-in slide-in-from-bottom-4"
      >
        {DOCK_APPS.map((app) => {
          const active =
            !desktop && (app.href === "/dashboard" ? pathname === "/dashboard" : pathname.startsWith(app.href));
          const cls =
            "group relative grid size-11 place-items-center rounded-xl transition-transform duration-150 hover:-translate-y-1.5";
          const inner = (
            <>
              <span
                className={cn(
                  "grid size-11 place-items-center rounded-xl border transition-colors",
                  active
                    ? "border-primary/40 bg-gradient-to-br from-primary/25 to-[oklch(0.66_0.22_285)]/20 text-primary"
                    : "border-border/60 bg-muted/50 text-muted-foreground group-hover:text-foreground",
                )}
              >
                <app.icon className="size-5" aria-hidden="true" />
              </span>
              <span
                className={cn(
                  "absolute -bottom-0.5 size-1 rounded-full bg-primary transition-opacity",
                  active ? "opacity-100" : "opacity-0",
                )}
              />
              <span className="pointer-events-none absolute -top-8 scale-90 rounded-md border border-border/60 bg-popover px-2 py-0.5 text-xs font-medium opacity-0 shadow-md transition-all group-hover:scale-100 group-hover:opacity-100">
                {app.label}
              </span>
            </>
          );
          return desktop ? (
            <button key={app.href} type="button" onClick={() => open(app.app)} title={app.label} aria-label={app.label} className={cls}>
              {inner}
            </button>
          ) : (
            <Link key={app.href} href={app.href} title={app.label} aria-label={app.label} className={cls}>
              {inner}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
