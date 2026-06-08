"use client";

import { LogOut, Settings, User } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import { signOutAction } from "@/app/auth/actions";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { cn } from "@/lib/utils";

/**
 * Account control for the OS menu bar: profile, settings, theme, and sign out —
 * the things every app's top-right avatar holds. Sign out runs the Better Auth
 * server action via a form (it redirects to /auth/sign-in).
 */
export function UserMenu() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative flex items-center gap-1.5">
      <ThemeToggle />

      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Account menu"
        className={cn(
          "grid size-7 place-items-center rounded-full border border-border/70 bg-muted/40 text-muted-foreground transition-colors hover:text-foreground",
          open && "text-foreground ring-1 ring-inset ring-primary/30",
        )}
      >
        <User className="size-3.5" aria-hidden="true" />
      </button>

      {open ? (
        <div
          role="menu"
          className="absolute right-0 top-9 z-50 w-44 overflow-hidden rounded-xl border border-border/70 bg-card/95 p-1 text-sm shadow-xl backdrop-blur-md duration-150 animate-in fade-in slide-in-from-top-1"
        >
          <MenuLink href="/dashboard/profile" icon={<User className="size-3.5" />} onClick={() => setOpen(false)}>
            Profile
          </MenuLink>
          <MenuLink href="/dashboard/settings" icon={<Settings className="size-3.5" />} onClick={() => setOpen(false)}>
            Settings
          </MenuLink>
          <div className="my-1 h-px bg-border/60" />
          <form action={signOutAction}>
            <button
              type="submit"
              role="menuitem"
              className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <LogOut className="size-3.5" aria-hidden="true" />
              Sign out
            </button>
          </form>
        </div>
      ) : null}
    </div>
  );
}

function MenuLink({
  href,
  icon,
  children,
  onClick,
}: {
  href: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  onClick?: () => void;
}) {
  return (
    <Link
      href={href}
      role="menuitem"
      onClick={onClick}
      className="flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
    >
      {icon}
      {children}
    </Link>
  );
}
