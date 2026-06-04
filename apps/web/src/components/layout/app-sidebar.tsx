"use client";

import { ChevronLeft, Sparkles, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { KaiBadge } from "@/components/ui/kai-badge";
import { cn } from "@/lib/utils";
import { appNavGroups } from "@/lib/navigation";
import { useSidebar } from "./sidebar-context";

export function AppSidebar() {
  const pathname = usePathname();
  const { mobileOpen, setMobileOpen, collapsed, toggleCollapsed } = useSidebar();

  return (
    <>
      {/* Mobile overlay */}
      {mobileOpen ? (
        <button
          aria-label="Close menu"
          onClick={() => setMobileOpen(false)}
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden"
        />
      ) : null}

      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex flex-col border-r border-border/60 bg-sidebar transition-[width,transform] duration-200 ease-out",
          collapsed ? "w-[4.75rem]" : "w-64",
          mobileOpen ? "translate-x-0" : "-translate-x-full",
          "lg:static lg:translate-x-0",
        )}
      >
        {/* Logo + controls */}
        <div className="flex h-16 items-center gap-2.5 border-b border-border/60 px-4">
          <div className="glow-primary flex size-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-[oklch(0.66_0.22_285)]">
            <Sparkles className="size-4 text-primary-foreground" aria-hidden="true" />
          </div>
          {!collapsed ? (
            <Link href="/dashboard" className="flex-1 truncate font-semibold tracking-tight">
              CareerOS
            </Link>
          ) : null}
          {/* Desktop collapse */}
          <button
            onClick={toggleCollapsed}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            className="hidden size-7 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground lg:grid"
          >
            <ChevronLeft className={cn("size-4 transition-transform", collapsed && "rotate-180")} aria-hidden="true" />
          </button>
          {/* Mobile close */}
          <button
            onClick={() => setMobileOpen(false)}
            aria-label="Close menu"
            className="grid size-7 place-items-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground lg:hidden"
          >
            <X className="size-4" aria-hidden="true" />
          </button>
        </div>

        {/* Nav groups */}
        <nav className="flex-1 space-y-5 overflow-y-auto p-3">
          {appNavGroups.map((group) => (
            <div key={group.label} className="space-y-1">
              {!collapsed ? (
                <p className="px-3 pb-1 text-[0.65rem] font-semibold uppercase tracking-[0.14em] text-muted-foreground/70">
                  {group.label}
                </p>
              ) : (
                <div className="mx-3 mb-1 h-px bg-border/60" />
              )}
              {group.items.map((item) => {
                const isActive =
                  item.href === "/dashboard"
                    ? pathname === "/dashboard"
                    : pathname.startsWith(item.href);

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMobileOpen(false)}
                    title={collapsed ? item.label : undefined}
                    className={cn(
                      "relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
                      collapsed && "justify-center px-0",
                      isActive
                        ? "bg-gradient-to-r from-primary/18 to-[oklch(0.66_0.22_285)]/12 font-medium text-primary ring-1 ring-inset ring-primary/25 before:absolute before:left-0 before:top-1/2 before:h-5 before:w-0.5 before:-translate-y-1/2 before:rounded-full before:bg-primary before:shadow-[0_0_8px_var(--primary)]"
                        : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
                    )}
                  >
                    <item.icon className="size-4 shrink-0" aria-hidden="true" />
                    {!collapsed ? item.label : null}
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>

        {/* Kai presence footer */}
        {!collapsed ? (
          <div className="border-t border-border/60 p-4">
            <div className="gradient-border glass-card rounded-lg p-3 space-y-2">
              <KaiBadge size="xs" />
              <p className="text-xs leading-relaxed text-muted-foreground">
                Kai is analyzing your profile and looking for new opportunities.
              </p>
            </div>
          </div>
        ) : (
          <div className="flex justify-center border-t border-border/60 p-3">
            <KaiBadge size="xs" showName={false} />
          </div>
        )}
      </aside>
    </>
  );
}
