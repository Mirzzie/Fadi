"use client";

import { useEffect, useState, useTransition } from "react";
import { Layers, Loader2, Undo2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  findSameEvidence,
  mergeEvidence,
  type SameThingPair,
} from "@/app/dashboard/evidence/actions";

/**
 * "THESE LOOK LIKE THE SAME THING."
 *
 * The pool is the source every other surface projects from — the résumé, the
 * portfolio, the prompt block Fadi reasons with — so one reality stored twice becomes
 * a duplicate everywhere at once. This is the only place it can honestly be fixed.
 *
 * MERGING IS NOT DELETING, and the copy says so plainly, because the fear it has to
 * answer is "will I lose the version I wrote for that application?" The absorbed
 * record keeps its wording as an alternative phrasing of the surviving fact, and the
 * merge is reversible. Nothing here acts without a click.
 */
export function SameThingPanel({ onChanged }: { onChanged: () => void }) {
  const [pairs, setPairs] = useState<SameThingPair[] | null>(null);
  const [done, setDone] = useState<Set<string>>(new Set());
  const [pending, startTransition] = useTransition();

  const load = () => {
    findSameEvidence().then((res) => setPairs(res.ok ? res.pairs : []));
  };
  useEffect(load, []);

  if (!pairs || pairs.length === 0) return null;
  const open = pairs.filter((p) => !done.has(p.mergeId));
  if (open.length === 0) return null;

  const confident = open.filter((p) => p.confident);
  const possible = open.filter((p) => !p.confident);

  function merge(pair: SameThingPair) {
    startTransition(async () => {
      const res = await mergeEvidence({ keepId: pair.keepId, mergeId: pair.mergeId });
      if (res.ok) {
        setDone((prev) => new Set(prev).add(pair.mergeId));
        onChanged();
      }
    });
  }

  return (
    <div className="mb-6 rounded-xl border border-warning/30 bg-warning/5 p-4">
      <div className="flex items-center gap-2">
        <Layers className="size-4 text-warning" aria-hidden="true" />
        <h3 className="text-sm font-semibold">Same thing, written twice</h3>
        <span className="rounded-full bg-warning/20 px-2 py-0.5 text-[10px] text-warning">
          {open.length}
        </span>
      </div>
      <p className="mt-1.5 text-xs text-muted-foreground">
        Tailoring your history for a different role produces new wording, not new experience. Merging
        keeps <span className="text-foreground">both versions</span> — the one you merge becomes an
        alternative phrasing of the same fact, and it stops counting as separate work everywhere else.
      </p>

      <div className="mt-3 space-y-2">
        {[...confident, ...possible].map((p) => (
          <div key={`${p.keepId}-${p.mergeId}`} className="rounded-lg border border-border bg-background/40 p-3">
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={`rounded-full border px-2 py-0.5 text-[10px] ${
                  p.confident
                    ? "border-warning/40 bg-warning/10 text-warning"
                    : "border-border bg-muted/40 text-muted-foreground"
                }`}
              >
                {p.confident ? "Same thing" : "Possibly the same"}
              </span>
              <span className="text-[11px] text-muted-foreground">{p.reasons.join("; ")}</span>
            </div>

            <div className="mt-2 grid gap-1.5 text-sm sm:grid-cols-[1fr_auto_1fr] sm:items-center">
              <span className="truncate">
                <span className="text-[10px] uppercase tracking-wide text-muted-foreground">Keep</span>{" "}
                <span className="font-medium">{p.keepTitle}</span>
              </span>
              <span className="text-muted-foreground">←</span>
              <span className="truncate text-muted-foreground">
                <span className="text-[10px] uppercase tracking-wide">Fold in</span> {p.mergeTitle}
              </span>
            </div>

            <div className="mt-2.5 flex justify-end gap-2">
              <Button size="sm" variant="outline" disabled={pending} onClick={() => merge(p)}>
                {pending ? <Loader2 className="size-4 animate-spin" /> : <Layers className="size-4" />}
                Merge as one
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setDone((prev) => new Set(prev).add(p.mergeId))}
              >
                They&apos;re different
              </Button>
            </div>
          </div>
        ))}
      </div>

      <p className="mt-2.5 flex items-center gap-1.5 text-[11px] text-muted-foreground">
        <Undo2 className="size-3" aria-hidden="true" />
        Every merge can be undone — nothing you wrote is deleted.
      </p>
    </div>
  );
}
