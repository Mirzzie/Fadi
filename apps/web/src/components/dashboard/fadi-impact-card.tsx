import { ShieldCheck, Clock, Compass, Send } from "lucide-react";

import type { FadiImpact } from "@/lib/impact/fadi-impact";

/**
 * The proof surface — honest evidence Fadi is earning its place, not a gimmick.
 * Real counts from the user's own data; the hours figure is a labelled estimate.
 * Renders nothing until there's at least one real number to show (no empty flex).
 */
export function FadiImpactCard({ impact }: { impact: FadiImpact }) {
  const role = impact.targetRole ?? "your direction";
  const stats = [
    {
      icon: ShieldCheck,
      value: impact.deadPostingsHidden,
      label: "of your tracked roles turned out closed",
      hint: "caught by the liveness check before more time went in",
    },
    {
      icon: Compass,
      value: impact.offDirectionFlagged,
      label: `saved roles flagged as off ${role}`,
      hint: "off-role or above your level — surfaced honestly, never hidden",
    },
    {
      icon: Send,
      value: impact.applicationsSent,
      label: "applications you've sent",
      hint: `${impact.savedCount} saved`,
    },
  ].filter((s) => s.value > 0);

  if (stats.length === 0) return null;

  return (
    <section className="rounded-xl border bg-card p-4">
      <div className="flex items-center gap-2 text-sm font-semibold">
        <ShieldCheck className="size-4 text-primary" aria-hidden="true" />
        What Fadi has done for you
      </div>
      <p className="mt-0.5 text-xs text-muted-foreground">
        Real numbers from your search — no hype, no vanity metrics.
      </p>

      <div className="mt-3 grid gap-3 sm:grid-cols-3">
        {stats.map((s, i) => (
          <div key={i} className="rounded-lg border bg-muted/30 p-3">
            <div className="flex items-baseline gap-1.5">
              <span className="text-2xl font-semibold tabular-nums">{s.value}</span>
            </div>
            <p className="mt-0.5 text-xs font-medium text-foreground/90">{s.label}</p>
            <p className="mt-0.5 text-[0.7rem] text-muted-foreground">{s.hint}</p>
          </div>
        ))}
      </div>

      {impact.estimatedHoursProtected > 0 ? (
        <p className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground">
          <Clock className="size-3.5 text-primary" aria-hidden="true" />
          ~{impact.estimatedHoursProtected}h you didn&apos;t spend chasing off-fit roles
          <span className="text-muted-foreground/70">
            (estimate — {45} min/application, 2026 industry average)
          </span>
        </p>
      ) : null}
    </section>
  );
}
