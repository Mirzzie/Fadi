import { Sparkles } from "lucide-react";
import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-border/60 bg-background/80 backdrop-blur-sm">
      <div className="mx-auto flex h-16 max-w-shell items-center justify-between px-4 sm:px-6">
        <Link href="/" className="flex items-center gap-2.5">
          <div className="flex size-8 items-center justify-center rounded-lg bg-primary">
            <Sparkles className="size-4 text-primary-foreground" aria-hidden="true" />
          </div>
          <span className="font-semibold tracking-tight">Fadi</span>
        </Link>
        <nav className="flex items-center gap-2">
          <Link href="/auth/sign-in" className={buttonVariants({ variant: "ghost", size: "sm" })}>
            Sign in
          </Link>
          <Link href="/auth/sign-up" className={buttonVariants({ size: "sm" })}>
            Get started
          </Link>
        </nav>
      </div>
    </header>
  );
}
