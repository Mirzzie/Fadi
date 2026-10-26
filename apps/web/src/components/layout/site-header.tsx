import Link from "next/link";
import { FadiLogo } from "@/components/brand/fadi-logo";

import { buttonVariants } from "@/components/ui/button";

export function SiteHeader({ showAuthLinks = true }: { showAuthLinks?: boolean }) {
  return (
    <header className="fadi-glass sticky top-0 z-40 border-b border-border">
      <div className="mx-auto flex h-16 max-w-shell items-center justify-between px-4 sm:px-6">
        <Link href="/" className="flex items-center gap-2.5">
          <FadiLogo className="size-7" />
          <span className="font-semibold tracking-tight">Fadi</span>
        </Link>
        {showAuthLinks ? (
          <nav aria-label="Account" className="flex items-center gap-2">
            <Link href="/auth/sign-in" className={buttonVariants({ variant: "ghost", size: "sm" })}>
              Sign in
            </Link>
            <Link href="/auth/sign-up" className={buttonVariants({ size: "sm" })}>
              Get started
            </Link>
          </nav>
        ) : null}
      </div>
    </header>
  );
}
