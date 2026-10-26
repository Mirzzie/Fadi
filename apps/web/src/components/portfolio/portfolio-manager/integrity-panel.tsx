"use client";

import {
  AlertTriangle,
  Clock,
  Copy,
  Info,
  Loader2,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { useState } from "react";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import type { IntegrityFinding, IntegritySeverity } from "@careeros/portfolio";

const SEVERITY: Record<
  IntegritySeverity,
  { label: string; cls: string; Icon: typeof AlertTriangle }
> = {
  contradiction: {
    label: "Contradiction",
    cls: "border-destructive/40 bg-destructive/10 text-destructive",
    Icon: ShieldAlert,
  },
  timeline: {
    label: "Timeline",
    cls: "border-info/40 bg-info/10 text-info",
    Icon: Clock,
  },
  duplicate: {
    label: "Duplicate",
    cls: "border-warning/40 bg-warning/10 text-warning",
    Icon: Copy,
  },
  anomaly: {
    label: "Anomaly",
    cls: "border-warning/40 bg-warning/10 text-warning",
    Icon: AlertTriangle,
  },
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
  onResolve,
  onResolveAll,
  resolving,
}: {
  findings: IntegrityFinding[];
  checking: boolean;
  aiRan: boolean;
  aiNote: string | null;
  titleOf: (id: string) => string | undefined;
  onRunAi: () => void;
  /**
   * Resolve a duplicate. Fadi recommends which copy to keep; the owner decides and
   * clicks. "hide" unpublishes (reversible, keeps the detail); "delete" is permanent.
   */
  onResolve?: (input: { dropId: string; mode: "hide" | "delete" }) => void;
  /**
   * Clear the confident duplicates in one go.
   *
   * Eight findings, each wanting a decision, is a chore list — and a chore list is
   * demoralising in a tool whose whole job is to make someone feel able to apply. Worse,
   * this backlog is HISTORICAL: the admission gate now prevents these at the write, so
   * the list can only shrink. Making someone grind through it one row at a time to reach
   * a state the product already guarantees is punishment for a bug they did not cause.
   *
   * Hide, never delete, for the bulk path. Reversible in a click, and a mistake costs
   * nothing — which is the only reason it is safe to offer as one button.
   */
  onResolveAll?: (input: { dropIds: string[] }) => void;
  resolving?: boolean;
}) {
  const [deleting, setDeleting] = useState<{ id: string; name: string } | null>(null);
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
        {(() => {
          // Only the pairs Fadi is confident about and has a recommendation for. A
          // "might be the same" is a question, and bulk-answering questions is how you
          // lose real work.
          const sure = findings.filter(
            (f) =>
              f.severity === "duplicate" && f.dropId && f.title === "The same work, written twice"
          );
          if (!onResolveAll || sure.length < 2) return null;
          return (
            <Button
              size="sm"
              variant="outline"
              disabled={resolving}
              onClick={() => onResolveAll({ dropIds: sure.map((f) => f.dropId!) })}
            >
              <Copy className="size-4" aria-hidden="true" />
              Hide all {sure.length} duplicates
            </Button>
          );
        })()}
        <Button size="sm" variant="outline" onClick={onRunAi} disabled={checking}>
          {checking ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
          {checking ? "Checking…" : "Check with Fadi AI"}
        </Button>
      </div>

      {clean ? (
        <p className="mt-2 text-xs text-muted-foreground">
          {/* A FAILED CHECK IS NOT A CLEAN ONE. The owner saw "Fadi found no contradictions"
              sitting directly above "Fadi's AI answered in a shape Fadi couldn't read" — the
              panel asserting a result and admitting it had none, in the same breath. */}
          {aiNote
            ? "The deterministic duplicate check found nothing. The deeper AI check did not complete — see below."
            : aiRan
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
                  <span
                    className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] ${s.cls}`}
                  >
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

                {/* Fadi's recommendation, acted on with one click — but never without
                    it. Showing a problem and leaving the owner to fix it by hand is
                    not intelligence; removing something on their behalf is not consent. */}
                {onResolve && f.keepId && f.dropId ? (
                  <div className="mt-2.5 flex flex-wrap items-center gap-2 border-t border-border/60 pt-2.5">
                    <p className="text-[11px] text-muted-foreground">
                      Fadi suggests keeping{" "}
                      <span className="text-foreground">{titleOf(f.keepId) ?? "the other"}</span>
                      {f.keepReason ? ` — ${f.keepReason}` : ""}.
                    </p>
                    <div className="ml-auto flex gap-1.5">
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={resolving}
                        onClick={() => onResolve({ dropId: f.dropId!, mode: "hide" })}
                      >
                        Hide the other
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={resolving}
                        onClick={() => {
                          const name = titleOf(f.dropId!) ?? "this entry";
                          setDeleting({ id: f.dropId!, name });
                        }}
                        className="text-destructive hover:text-destructive"
                      >
                        Delete it
                      </Button>
                    </div>
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}

      {aiNote && <p className="mt-2 text-xs text-muted-foreground">{aiNote}</p>}
      <ConfirmDialog
        open={Boolean(deleting)}
        onOpenChange={(open) => {
          if (!open) setDeleting(null);
        }}
        title="Delete portfolio item?"
        description={`Permanently delete “${deleting?.name ?? ""}”? This cannot be undone.`}
        confirmLabel="Delete item"
        destructive
        busy={resolving}
        onConfirm={() => {
          if (deleting && onResolve) {
            onResolve({ dropId: deleting.id, mode: "delete" });
            setDeleting(null);
          }
        }}
      />
    </div>
  );
}
