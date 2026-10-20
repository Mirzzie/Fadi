"use client";

import { useEffect, useState, useTransition } from "react";
import { Layers, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  findSameEvidence,
  discardPendingEvidence,
  keepEvidenceSeparate,
  mergeEvidence,
  type SameThingPair,
} from "@/app/dashboard/evidence/actions";

export function SameThingPanel({ onChanged }: { onChanged: () => void }) {
  const [pairs, setPairs] = useState<SameThingPair[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const load = async () => {
    try {
      const result = await findSameEvidence();
      if (!result.ok) throw new Error("Review unavailable");
      setPairs(result.pairs);
    } catch {
      setError("Could not load pending matches. Please reload.");
    }
  };
  useEffect(() => {
    let active = true;
    void findSameEvidence().then(result => {
      if (!active) return;
      if (result.ok) setPairs(result.pairs);
      else setError("Could not load pending matches. Please reload.");
    }).catch(() => {
      if (active) setError("Could not load pending matches. Please reload.");
    });
    return () => { active = false; };
  }, []);

  function resolve(pair: SameThingPair, same: boolean | "discard") {
    setError(null);
    start(async () => {
      try {
        const result =
          same === "discard"
            ? await discardPendingEvidence({ id: pair.mergeId })
            : same
              ? await mergeEvidence({ keepId: pair.keepId, mergeId: pair.mergeId })
              : await keepEvidenceSeparate({ id: pair.mergeId, otherId: pair.keepId });
        if (!result.ok) {
          setError("Couldn't save that decision. Please reload and try again.");
          return;
        }
        // A join can undo an include/exclude choice the person made about one of the two records.
        // They are told here rather than finding out through a document later.
        setNotice("message" in result && typeof result.message === "string" ? result.message : null);
        await load();
        onChanged();
      } catch {
        setError("Couldn't save that decision. Please try again.");
      }
    });
  }

  if (!pairs?.length) return error ? <p role="alert">{error}</p> : null;
  return (
    <section className="rounded-xl border border-warning/30 bg-warning/5 p-4">
      <h2 className="flex items-center gap-2 text-sm font-semibold">
        <Layers className="size-4" aria-hidden="true" /> Review possible matches{" "}
        <span className="text-muted-foreground">{pairs.length}</span>
      </h2>
      <p className="mt-2 text-xs text-muted-foreground">
        Similar wording can describe different work. Check the organisation, dates and details
        before joining records. Pending imports stay out of evidence-based prompts and portfolio
        sync until you decide.
      </p>
      {notice ? (
        <p role="status" className="mt-2 text-sm text-muted-foreground">
          {notice}
        </p>
      ) : null}
      {error ? (
        <p role="alert" className="mt-2 text-sm text-destructive">
          {error}
        </p>
      ) : null}
      <div className="mt-3 space-y-3">
        {pairs.map((pair) => (
          <article
            key={`${pair.keepId}:${pair.mergeId}`}
            className="rounded-lg border border-border bg-background p-3"
          >
            <p className="text-xs text-muted-foreground">
              {pair.pendingReview
                ? "Imported wording · awaiting your decision"
                : "Existing records · possible match"}
            </p>
            <div className="mt-2 grid gap-3 sm:grid-cols-2">
              <div>
                <p className="text-xs text-muted-foreground">Existing record</p>
                <p className="text-sm font-medium">{pair.keepTitle}</p>
                <p className="mt-1 text-xs text-muted-foreground">{pair.keepContext}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Compare with</p>
                <p className="text-sm font-medium">{pair.mergeTitle}</p>
                <p className="mt-1 text-xs text-muted-foreground">{pair.mergeContext}</p>
              </div>
            </div>
            <details className="mt-2 text-xs">
              <summary className="cursor-pointer">Compare descriptions</summary>
              <div className="mt-2 grid gap-3 whitespace-pre-wrap sm:grid-cols-2">
                <p>{pair.keepDetail || "No description"}</p>
                <p>{pair.mergeDetail || "No description"}</p>
              </div>
              <p className="mt-2 text-muted-foreground">
                Suggested because: {pair.reasons.join("; ")}
              </p>
            </details>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button
                size="sm"
                variant="outline"
                disabled={pending || pair.canMerge === false}
                onClick={() => resolve(pair, true)}
              >
                {pending ? <Loader2 className="size-3 animate-spin" aria-hidden="true" /> : null}
                Same work · keep existing facts
              </Button>
              <Button
                size="sm"
                variant="ghost"
                disabled={pending}
                onClick={() => resolve(pair, false)}
              >
                {pair.canMerge === false ? "Keep as separate work" : "They're different"}
              </Button>
              {pair.pendingReview ? (
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={pending}
                  onClick={() => resolve(pair, "discard")}
                >
                  Discard this import
                </Button>
              ) : null}
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              Joining keeps both descriptions. It does not change the existing employer or dates, or
              rewrite saved documents.
            </p>
          </article>
        ))}
      </div>
    </section>
  );
}
