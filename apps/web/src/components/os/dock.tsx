"use client";

import {
  BriefcaseBusiness,
  FileText,
  GraduationCap,
  KanbanSquare,
  LayoutDashboard,
  Settings,
  Sparkles,
  UserRoundCog,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

type DockApp = { href: string; label: string; icon: LucideIcon };

const DOCK_APPS: DockApp[] = [
  { href: "/dashboard", label: "Home", icon: LayoutDashboard },
  { href: "/dashboard/jobs", label: "Jobs", icon: BriefcaseBusiness },
  { href: "/dashboard/applications", label: "Applications", icon: KanbanSquare },
  { href: "/dashboard/documents", label: "Documents", icon: FileText },
  { href: "/dashboard/learning", label: "Learning", icon: GraduationCap },
  { href: "/dashboard/kai", label: "Kai", icon: Sparkles },
  { href: "/dashboard/profile", label: "Profile", icon: UserRoundCog },
  { href: "/dashboard/settings", label: "Settings", icon: Settings },
];

/** The OS dock — app launcher pinned to the bottom, present in both modes. */
export function Dock() {
  const pathname = usePathname();

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-3 z-40 flex justify-center px-3">
      <nav
        aria-label="Apps"
        className="pointer-events-auto flex items-end gap-1.5 rounded-2xl border border-border/60 bg-background/70 px-2.5 py-2 shadow-2xl backdrop-blur-xl duration-500 animate-in fade-in slide-in-from-bottom-4"
      >
        {DOCK_APPS.map((app) => {
          const active =
            app.href === "/dashboard" ? pathname === "/dashboard" : pathname.startsWith(app.href);
          return (
            <Link
              key={app.href}
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
                    : "border-border/60 bg-muted/50 text-muted-foreground group-hover:text-foreground",
                )}
              >
                <app.icon className="size-5" aria-hidden="true" />
              </span>
              {/* Running indicator dot */}
              <span
                className={cn(
                  "absolute -bottom-0.5 size-1 rounded-full bg-primary transition-opacity",
                  active ? "opacity-100" : "opacity-0",
                )}
              />
              {/* Hover label */}
              <span className="pointer-events-none absolute -top-8 scale-90 rounded-md border border-border/60 bg-popover px-2 py-0.5 text-xs font-medium opacity-0 shadow-md transition-all group-hover:scale-100 group-hover:opacity-100">
                {app.label}
              </span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
