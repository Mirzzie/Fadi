"use client";

import Link from "next/link";
import { Bell, LogOut, Menu, Search } from "lucide-react";

import { signOutAction } from "@/app/auth/actions";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { Button } from "@/components/ui/button";
import { useSidebar } from "./sidebar-context";

export function AppHeader() {
  const { setMobileOpen } = useSidebar();

  return (
    <header className="sticky top-0 z-30 flex h-16 shrink-0 items-center gap-3 border-b border-border/60 bg-background/70 px-3 backdrop-blur-md sm:px-5">
      {/* Mobile menu */}
      <Button
        variant="ghost"
        size="icon"
        className="size-9 lg:hidden"
        onClick={() => setMobileOpen(true)}
        aria-label="Open menu"
      >
        <Menu className="size-5" aria-hidden="true" />
      </Button>

      {/* Search */}
      <div className="relative max-w-xl flex-1">
        <Search
          className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden="true"
        />
        <input
          type="search"
          placeholder="Search jobs, learning, or ask Kai…"
          className="h-10 w-full rounded-full border border-border/60 bg-card/60 pl-10 pr-4 text-sm outline-none transition-colors placeholder:text-muted-foreground focus:border-primary/40 focus:ring-2 focus:ring-primary/15"
        />
      </div>

      {/* Right actions */}
      <div className="flex items-center gap-1.5 sm:gap-2">
        <ThemeToggle />
        <button
          type="button"
          aria-label="Notifications"
          className="relative grid size-9 place-items-center rounded-full border border-border/60 bg-card text-muted-foreground transition-colors hover:text-foreground"
        >
          <Bell className="size-4" aria-hidden="true" />
          <span className="absolute right-2 top-2 size-1.5 rounded-full bg-primary" aria-hidden="true" />
        </button>
        <Link
          href="/dashboard/profile"
          aria-label="Your profile"
          className="glow-primary size-9 shrink-0 rounded-full bg-gradient-to-br from-primary to-[oklch(0.62_0.22_300)] ring-2 ring-background"
        />
        <form action={signOutAction}>
          <Button type="submit" variant="ghost" size="icon" className="size-9" aria-label="Sign out">
            <LogOut className="size-4" aria-hidden="true" />
          </Button>
        </form>
      </div>
    </header>
  );
}
