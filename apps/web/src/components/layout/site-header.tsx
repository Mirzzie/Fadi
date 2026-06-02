import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";

export function SiteHeader() {
  return (
    <header className="border-b bg-background/95">
      <div className="mx-auto flex h-16 max-w-shell items-center justify-between px-4 sm:px-6">
        <Link href="/" className="flex items-center gap-2 font-semibold">
          <span className="grid size-8 place-items-center rounded-md bg-primary text-sm text-primary-foreground">
            C
          </span>
          <span>CareerOS AI</span>
        </Link>
        <nav className="flex items-center gap-2">
          <Link href="/auth/sign-in" className={buttonVariants({ variant: "ghost" })}>
            Sign in
          </Link>
          <Link href="/auth/sign-up" className={buttonVariants()}>
            Get started
          </Link>
        </nav>
      </div>
    </header>
  );
}
