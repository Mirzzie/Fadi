"use client";

import { AlertTriangle, Clock, Copy, Info, Loader2, ShieldAlert, ShieldCheck, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { IntegrityFinding, IntegritySeverity } from "@careeros/portfolio";

const SEVERITY: Record<
  IntegritySeverity,
  { label: string; cls: string; Icon: typeof AlertTriangle }
> = {
  contradiction: { label: "Contradiction", cls: "border-destructive/40 bg-destructive/10 text-destructive", Icon: ShieldAlert },
  timeline: { label: "Timeline", cls: "border-orange-500/40 bg-orange-500/10 text-orange-400", Icon: Clock },
  duplicate: { label: "Duplicate", cls: "border-warning/40 bg-warning/10 text-warning", Icon: Copy },
  anomaly: { label: "Anomaly", cls: "border-yellow-500/40 bg-yellow-500/10 text-yellow-500", Icon: AlertTriangle },
  info: { label: "Note", cls: "border-border bg-muted/40 text-muted-foreground", Icon: Info },
};

/**
 * Portfolio integrity: deterministic duplicate findings (free, always current) plus an
 * on-demand Fadi AI pass for contradictions / timeline / anomalies. Detect & propose only.
 */
export function IntegrityPanel({
  findings,
  checking,
  aiRan,
  aiNote,
  titleOf,
  onRunAi,
}: {
  findings: IntegrityFinding[];
  checking: boolean;
  aiRan: boolean;
  aiNote: string | null;
  titleOf: (id: string) => string | undefined;
  onRunAi: () => void;
}) {
  const clean = findings.length === 0;
  return (
    <div className="mb-6 rounded-xl border border-border bg-muted/20 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          {clean ? (
            <ShieldCheck className="size-4 text-success" aria-hidden="true" />
          ) : (
            <ShieldAlert className="size-4 text-warning" aria-hidden="true" />
          )}
          <h3 className="text-sm font-semibold">Integrity check</h3>
          {!clean && (
            <span className="rounded-full bg-warning/20 px-2 py-0.5 text-[10px] text-warning">
              {findings.length}
            </span>
          )}
        </div>
        <Button size="sm" variant="outline" onClick={onRunAi} disabled={checking}>
          {checking ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
          {checking ? "Checking…" : "Check with Fadi AI"}
        </Button>
      </div>

      {clean ? (
        <p className="mt-2 text-xs text-muted-foreground">
          {aiRan
            ? "Fadi found no contradictions, timeline errors, or duplicates."
            : "No duplicates found. Run Fadi AI for a deeper check of contradictions and timeline logic."}
        </p>
      ) : (
        <ul className="mt-3 space-y-2">
          {findings.map((f, i) => {
            const s = SEVERITY[f.severity] ?? SEVERITY.info;
            const names = f.itemIds.map((id) => titleOf(id)).filter(Boolean) as string[];
            return (
              <li
                key={`${f.severity}-${i}`}
                className="rounded-lg border border-border bg-background/40 p-3 text-sm"
              >
                <div className="flex items-center gap-2">
                  <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] ${s.cls}`}>
                    <s.Icon className="size-3" aria-hidden="true" /> {s.label}
                  </span>
                  <span className="font-medium">{f.title}</span>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">{f.detail}</p>
                {names.length > 0 && (
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    Involves: {names.join(" · ")}
                  </p>
                )}
                {f.suggestion && (
                  <p className="mt-1 text-[11px] text-warning">Suggested fix: {f.suggestion}</p>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {aiNote && <p className="mt-2 text-xs text-muted-foreground">{aiNote}</p>}
    </div>
  );
}
