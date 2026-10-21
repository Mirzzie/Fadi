"use client";

import Link from "next/link";
import { Palette } from "lucide-react";

export function ThemeToggle() {
  return (
    <Link
      href="/dashboard/settings#appearance"
      aria-label="Appearance settings"
      className="grid size-7 place-items-center rounded-full border border-border/70 bg-muted/40 text-muted-foreground transition-colors hover:text-foreground"
    >
      <Palette className="size-3.5" aria-hidden="true" />
    </Link>
  );
}
