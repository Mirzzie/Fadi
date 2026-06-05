import { ArrowRight, Check, Compass, Rocket } from "lucide-react";
import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";
import type { SetupState } from "@/lib/guidance/setup";
import { cn } from "@/lib/utils";

/**
 * The OS "Setup Assistant" — a guided path the user follows after logging in.
 * Reflects real state (from getSetupState) and points at the single next move,
 * so CareerOS guides instead of dumping a blank dashboard on a new user.
 */
export function GuidedSetup({ setup }: { setup: SetupState }) {
  const { steps, completed, total, percent, nextStep } = setup;

  return (
    <section className="overflow-hidden rounded-2xl border border-primary/25 bg-card/60">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/50 px-5 py-4">
        <div className="flex items-center gap-2.5">
          <span className="grid size-8 place-items-center rounded-xl bg-primary/15 text-primary">
            <Rocket className="size-4" aria-hidden="true" />
          </span>
          <div>
            <h2 className="text-sm font-semibold tracking-tight">Set up your Career OS</h2>
            <p className="text-xs text-muted-foreground">
              {completed} of {total} done — follow the path and I&apos;ll guide each step.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="h-1.5 w-28 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-primary transition-all"
              style={{ width: `${percent}%` }}
            />
          </div>
          <span className="text-xs font-medium tabular-nums text-muted-foreground">{percent}%</span>
        </div>
      </div>

      {/* The one recommended next move */}
      {nextStep ? (
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/50 bg-primary/5 px-5 py-3">
          <div className="min-w-0">
            <p className="text-[0.7rem] font-semibold uppercase tracking-wide text-primary">
              Next step
            </p>
            <p className="text-sm font-medium">{nextStep.title}</p>
            <p className="text-xs text-muted-foreground">{nextStep.description}</p>
          </div>
          <Link href={nextStep.href} className={cn(buttonVariants({ size: "sm" }), "shrink-0")}>
            {nextStep.cta}
            <ArrowRight className="size-3.5" aria-hidden="true" />
          </Link>
        </div>
      ) : null}

      <ol className="divide-y divide-border/40">
        {steps.map((step) => (
          <li key={step.id} className="flex items-center gap-3 px-5 py-2.5">
            <span
              className={cn(
                "grid size-5 shrink-0 place-items-center rounded-full border text-[0.7rem]",
                step.done
                  ? "border-emerald-400/40 bg-emerald-400/15 text-emerald-400"
                  : "border-border/60 text-muted-foreground",
              )}
            >
              {step.done ? <Check className="size-3" aria-hidden="true" /> : null}
            </span>
            <span
              className={cn(
                "min-w-0 flex-1 text-sm",
                step.done ? "text-muted-foreground line-through decoration-muted-foreground/40" : "",
              )}
            >
              {step.title}
            </span>
            {!step.done ? (
              <Link
                href={step.href}
                className="shrink-0 text-xs font-medium text-primary hover:underline"
              >
                {step.cta}
              </Link>
            ) : null}
          </li>
        ))}
      </ol>

      {setup.exploreNiche.suggested ? (
        <Link
          href={setup.exploreNiche.href}
          className="flex items-center gap-2 border-t border-border/50 px-5 py-3 text-sm text-muted-foreground transition-colors hover:bg-muted/40 hover:text-foreground"
        >
          <Compass className="size-4 shrink-0 text-primary" aria-hidden="true" />
          <span className="flex-1">Not sure which path fits? Explore your options in the Niche Finder.</span>
          <ArrowRight className="size-3.5 shrink-0" aria-hidden="true" />
        </Link>
      ) : null}
    </section>
  );
}
