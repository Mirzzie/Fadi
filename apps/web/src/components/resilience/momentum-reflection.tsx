import { ArrowRight, Heart, History, TrendingDown, TrendingUp } from "lucide-react";

import { cn } from "@/lib/utils";
import type { MomentumReflection, MoraleState, PastSelfTrend } from "@/lib/resilience/reflection";

const STATE_META: Record<MoraleState, { label: string; cls: string }> = {
  thriving: { label: "Thriving", cls: "text-emerald-300" },
  steady: { label: "Building", cls: "text-primary" },
  quiet: { label: "Quiet", cls: "text-muted-foreground" },
  // Never alarm-red — a struggling stretch is met with warmth, not a failure signal.
  struggling: { label: "A hard stretch", cls: "text-amber-300" },
};

function TrendIcon({ trend }: { trend: PastSelfTrend }) {
  if (trend === "up") return <TrendingUp className="size-4 text-emerald-400" aria-hidden="true" />;
  if (trend === "down") return <TrendingDown className="size-4 text-amber-400" aria-hidden="true" />;
  return <History className="size-4 text-muted-foreground" aria-hidden="true" />;
}

/** You-vs-your-past-self standing + a morale-aware next step. Honest, never shaming. */
export function MomentumReflectionCard({ reflection }: { reflection: MomentumReflection }) {
  const { pastSelf, morale } = reflection;
  const meta = STATE_META[morale.state];

  return (
    <section className="rounded-xl border bg-card p-5">
      <div className="flex items-center justify-between gap-3">
        <h3 className="flex items-center gap-2 text-sm font-semibold">
          <Heart className="size-4 text-primary" aria-hidden="true" />
          How you&apos;re really doing
        </h3>
        <span className={cn("text-xs font-medium", meta.cls)}>{meta.label}</span>
      </div>

      {/* You vs your past self — never vs other people. */}
      <div className="mt-3 flex items-start gap-2 rounded-md border bg-muted/40 p-3">
        <TrendIcon trend={pastSelf.trend} />
        <div>
          <p className="text-xs font-medium text-muted-foreground">You vs your past self</p>
          <p className="mt-0.5 text-sm">{pastSelf.line}</p>
        </div>
      </div>

      {/* Morale read + the one controllable next step. */}
      <p className="mt-3 text-sm text-foreground/90">{morale.line}</p>
      <p className="mt-2 flex items-start gap-2 rounded-md border-l-2 border-primary/50 bg-primary/5 py-1.5 pl-3 text-sm">
        <ArrowRight className="mt-0.5 size-3.5 shrink-0 text-primary" aria-hidden="true" />
        <span>
          <span className="font-medium text-primary">Your one next step: </span>
          {morale.nextStep}
        </span>
      </p>
    </section>
  );
}
