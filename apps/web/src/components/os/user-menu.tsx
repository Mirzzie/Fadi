"use client";

import { LogOut, Settings, User } from "lucide-react";
import Link from "next/link";

import { signOutAction } from "@/app/auth/actions";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

/**
 * Account control for the OS menu bar: profile, settings, theme, and sign out.
 * Backed by the Base UI dropdown-menu primitive — focus management, Escape,
 * outside-click dismissal and proper ARIA menu semantics come for free (this was
 * previously a hand-rolled overlay with manual listeners). Sign out runs the
 * Better Auth server action via a form (it redirects to /auth/sign-in).
 */
export function UserMenu() {
  return (
    <div className="flex items-center gap-1.5">
      <ThemeToggle />

      <DropdownMenu>
        <DropdownMenuTrigger
          aria-label="Account menu"
          className="grid size-7 place-items-center rounded-full border border-border/70 bg-muted/40 text-muted-foreground transition-colors hover:text-foreground data-popup-open:text-foreground data-popup-open:ring-1 data-popup-open:ring-inset data-popup-open:ring-primary/30"
        >
          <User className="size-3.5" aria-hidden="true" />
        </DropdownMenuTrigger>

        <DropdownMenuContent align="end" sideOffset={8} className="w-44">
          <DropdownMenuItem render={<Link href="/dashboard/profile" />}>
            <User className="size-3.5" aria-hidden="true" />
            Profile
          </DropdownMenuItem>
          <DropdownMenuItem render={<Link href="/dashboard/settings" />}>
            <Settings className="size-3.5" aria-hidden="true" />
            Settings
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <form action={signOutAction}>
            <DropdownMenuItem render={<button type="submit" />} nativeButton className="w-full">
              <LogOut className="size-3.5" aria-hidden="true" />
              Sign out
            </DropdownMenuItem>
          </form>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
