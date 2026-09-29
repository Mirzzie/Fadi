import Link from "next/link";
import { ChevronLeft } from "lucide-react";

/**
 * The way back from Learning's deeper pages.
 *
 * This used to be a four-tab bar — Overview, Projects, Machines, Activity — shown on every
 * Learning page, which taught every learner the infrastructure model before they had a
 * project that needed a machine. Those pages still exist, reached from Browse on the
 * Learning home and from the project that uses them; they just stop competing with it.
 */
export function LearningNavigation() {
  return (
    <nav aria-label="Learning" className="border-b border-border pb-2">
      <Link
        href="/dashboard/learning"
        className="inline-flex h-8 items-center gap-1 rounded-lg px-2 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
      >
        <ChevronLeft className="size-3.5" aria-hidden="true" />
        Learning
      </Link>
    </nav>
  );
}
