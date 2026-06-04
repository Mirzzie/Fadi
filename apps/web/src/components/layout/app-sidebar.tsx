"use client";

import { Sparkles } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { KaiBadge } from "@/components/ui/kai-badge";
import { cn } from "@/lib/utils";
import { appNavigation } from "@/lib/navigation";

export function AppSidebar() {
  const pathname = usePathname();

  return (
    <aside className="hidden w-64 shrink-0 border-r border-border/60 bg-sidebar lg:flex lg:flex-col">
      {/* Logo */}
      <div className="flex h-16 items-center gap-2.5 border-b border-border/60 px-5">
        <div className="glow-primary flex size-8 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-[oklch(0.66_0.22_285)]">
          <Sparkles className="size-4 text-primary-foreground" aria-hidden="true" />
        </div>
        <Link href="/dashboard" className="font-semibold tracking-tight">
          CareerOS
        </Link>
      </div>

      {/* Nav */}
      <nav className="flex-1 space-y-0.5 p-3">
        {appNavigation.map((item) => {
          const isActive =
            item.href === "/dashboard"
              ? pathname === "/dashboard"
              : pathname.startsWith(item.href);

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
                isActive
                  ? "bg-primary/12 font-medium text-primary ring-1 ring-inset ring-primary/25 before:absolute before:left-0 before:top-1/2 before:h-5 before:w-0.5 before:-translate-y-1/2 before:rounded-full before:bg-primary before:shadow-[0_0_8px_var(--primary)]"
                  : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
              )}
            >
              <item.icon className="size-4 shrink-0" aria-hidden="true" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* Kai presence footer */}
      <div className="border-t border-border/60 p-4">
        <div className="rounded-lg border border-primary/20 bg-primary/8 p-3 space-y-2">
          <KaiBadge size="xs" />
          <p className="text-xs text-muted-foreground leading-relaxed">
            Kai is analyzing your profile and looking for new opportunities.
          </p>
        </div>
      </div>
    </aside>
  );
}
