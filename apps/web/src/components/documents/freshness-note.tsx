import { History } from "lucide-react";

import type { DocumentFreshness } from "@/lib/documents/freshness.server";

/**
 * The document says when it has fallen behind the person's record.
 *
 * Quiet by design: this is information, not an alarm. A document can be exactly what someone
 * wants while their record has moved on, so it names the difference and leaves the decision
 * alone — the one-click version of acting on it sits in "Change it" below, where the rewrite
 * guard and the truth gate already apply.
 */
export function FreshnessNote({ freshness }: { freshness: DocumentFreshness }) {
  if (freshness.state !== "stale") return null;
  const { changes } = freshness;
  return (
    <div className="flex items-start gap-2.5 rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2.5">
      <History className="mt-0.5 size-4 shrink-0 text-amber-500" aria-hidden="true" />
      <div className="min-w-0 space-y-1">
        <p className="text-sm text-foreground">{freshness.note}</p>
        <p className="text-xs text-muted-foreground">
          {changes.added.length > 0
            ? `Ask for “${freshness.ask}” below to work it in, or leave this document as it is.`
            : "Ask Fadi below to bring it in line, or leave this document as it is."}
        </p>
      </div>
    </div>
  );
}
