"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2, Sparkles, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { autoPrepJobAction } from "@/app/dashboard/applications/[jobId]/workspace/actions";

export type BatchCandidate = { jobId: string; title: string; company: string };

type ItemState = { status: "pending" | "running" | "done" | "failed"; note?: string };

/**
 * Batch document prep — the core time-saver. One click drafts the full packet
 * (resume, cover letter, cold email, value prop) for every tracked role that has
 * a JD but no documents yet. Runs SEQUENTIALLY through the same per-job auto-prep
 * (idempotent — never clobbers existing drafts), on the user's own AI key, with
 * live progress and a cancel that finishes the current role and stops.
 */
export function BatchPrep({ candidates }: { candidates: BatchCandidate[] }) {
  const router = useRouter();
  const [items, setItems] = useState<Record<string, ItemState>>({});
  const [running, setRunning] = useState(false);
  const cancelled = useRef(false);

  if (candidates.length === 0) return null;

  const doneCount = Object.values(items).filter((i) => i.status === "done").length;

  async function run() {
    cancelled.current = false;
    setRunning(true);
    setItems(Object.fromEntries(candidates.map((c) => [c.jobId, { status: "pending" as const }])));

    for (const c of candidates) {
      if (cancelled.current) {
        setItems((prev) => ({ ...prev, [c.jobId]: { status: "failed", note: "skipped (cancelled)" } }));
        continue;
      }
      setItems((prev) => ({ ...prev, [c.jobId]: { status: "running" } }));
      try {
        const res = await autoPrepJobAction(c.jobId);
        setItems((prev) => ({
          ...prev,
          [c.jobId]: res.ok
            ? { status: "done", note: res.created > 0 ? `${res.created} drafted` : "already prepared" }
            : { status: "failed", note: res.message },
        }));
        // A no-history / no-provider failure will repeat for every role — stop honestly.
        if (!res.ok && /history|provider/i.test(res.message)) {
          cancelled.current = true;
        }
      } catch {
        setItems((prev) => ({ ...prev, [c.jobId]: { status: "failed", note: "failed — try it from its workspace" } }));
      }
    }
    setRunning(false);
    router.refresh();
  }

  return (
    <section className="mb-4 rounded-xl border border-primary/30 bg-primary/5 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="flex items-center gap-2 text-sm font-semibold">
            <Sparkles className="size-4 text-primary" aria-hidden="true" />
            {candidates.length} role{candidates.length === 1 ? "" : "s"} ready for documents
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            One click drafts the full packet for each — resume, cover letter, cold email, value prop —
            from your direction&apos;s base resume, in your own words. Runs on your AI key
            (~4 documents per role); you give each a final human pass before sending.
          </p>
        </div>
        {running ? (
          <Button size="sm" variant="outline" onClick={() => (cancelled.current = true)}>
            <X className="size-3.5" aria-hidden="true" /> Stop after this one
          </Button>
        ) : (
          <Button size="sm" onClick={run}>
            <Sparkles className="size-3.5" aria-hidden="true" />
            {doneCount > 0 ? "Prepare again" : `Prepare all ${candidates.length}`}
          </Button>
        )}
      </div>

      {Object.keys(items).length > 0 ? (
        <ul className="mt-3 space-y-1">
          {candidates.map((c) => {
            const it = items[c.jobId];
            if (!it) return null;
            return (
              <li key={c.jobId} className="flex items-center gap-2 text-xs">
                {it.status === "running" ? (
                  <Loader2 className="size-3.5 shrink-0 animate-spin text-primary" aria-hidden="true" />
                ) : it.status === "done" ? (
                  <Check className="size-3.5 shrink-0 text-emerald-400" aria-hidden="true" />
                ) : it.status === "failed" ? (
                  <X className="size-3.5 shrink-0 text-rose-400" aria-hidden="true" />
                ) : (
                  <span className="size-3.5 shrink-0 rounded-full border border-border" aria-hidden="true" />
                )}
                <span className="truncate">
                  {c.title} · {c.company}
                </span>
                {it.note ? <span className="shrink-0 text-muted-foreground">— {it.note}</span> : null}
              </li>
            );
          })}
        </ul>
      ) : null}
    </section>
  );
}
