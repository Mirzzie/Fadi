import Link from "next/link";
import { Menu } from "lucide-react";

import { signOutAction } from "@/app/auth/actions";
import { Button, buttonVariants } from "@/components/ui/button";

export function AppHeader() {
  return (
    <header className="flex h-16 shrink-0 items-center justify-between border-b border-border/60 bg-background/80 px-4 backdrop-blur-sm sm:px-6">
      {/* Mobile logo */}
      <div className="flex items-center gap-3 lg:hidden">
        <Button variant="ghost" size="icon" className="size-8">
          <Menu className="size-4" aria-hidden="true" />
          <span className="sr-only">Toggle menu</span>
        </Button>
        <span className="font-semibold">CareerOS</span>
      </div>

      {/* Desktop left — breadcrumb placeholder */}
      <div className="hidden lg:block">
        <p className="text-sm font-medium">Career command center</p>
      </div>

      {/* Right actions */}
      <div className="flex items-center gap-2">
        <Link href="/onboarding" className={buttonVariants({ variant: "outline", size: "sm" })}>
          Edit profile
        </Link>
        <form action={signOutAction}>
          <Button type="submit" variant="ghost" size="sm">
            Sign out
          </Button>
        </form>
      </div>
    </header>
  );
}
