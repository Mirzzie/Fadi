import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";

export function AppHeader() {
  return (
    <header className="flex h-16 items-center justify-between border-b bg-background px-4 sm:px-6">
      <div>
        <p className="text-sm text-muted-foreground">MVP Foundation</p>
        <h1 className="text-base font-semibold">Career command center</h1>
      </div>
      <Link href="/onboarding" className={buttonVariants({ variant: "outline" })}>
        Continue onboarding
      </Link>
    </header>
  );
}
