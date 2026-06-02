import Link from "next/link";

import { signOutAction } from "@/app/auth/actions";
import { Button, buttonVariants } from "@/components/ui/button";

export function AppHeader() {
  return (
    <header className="flex h-16 items-center justify-between border-b bg-background px-4 sm:px-6">
      <div>
        <p className="text-sm text-muted-foreground">MVP Foundation</p>
        <h1 className="text-base font-semibold">Career command center</h1>
      </div>
      <div className="flex items-center gap-2">
        <Link href="/onboarding" className={buttonVariants({ variant: "outline" })}>
          Continue onboarding
        </Link>
        <form action={signOutAction}>
          <Button type="submit" variant="ghost">
            Sign out
          </Button>
        </form>
      </div>
    </header>
  );
}
