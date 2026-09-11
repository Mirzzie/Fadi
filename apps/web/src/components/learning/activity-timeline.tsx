"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import { AlertTriangle, Loader2 } from "lucide-react";

import { listPermissions } from "@/app/dashboard/learning/permission-actions";
import { groupActivity, type ActivityGroup } from "@/lib/lab/activity-view";

/**
 * WHAT FADI DID, AND WHAT IT WAS TRYING TO DO.
 *
 * The audit list used to be a monospace dump — every command its own row, "podman not
 * installed" three times over. Complete, and unreadable, which is the same as absent.
 *
 * Grouped by intent, with refusals never folded in: those are the lines that have to be
 * read, and burying one inside "3 checks" is how it stops being read.
 */

const ACTOR: Record<string, string> = {
  user: "you",
  model: "the AI model",
  mcp: "an MCP client",
  agent: "a background agent",
};

const TONE: Record<string, string> = {
  denied: "text-amber-500",
  allowed: "text-emerald-500",
  asked: "text-muted-foreground",
  unavailable: "text-muted-foreground",
  error: "text-muted-foreground",
  mixed: "text-muted-foreground",
};

export function ActivityTimeline() {
  const [groups, setGroups] = useState<ActivityGroup[] | null>(null);
  const [pending, start] = useTransition();

  const refresh = useCallback(() => {
    start(async () => {
      const res = await listPermissions();
      if (res.ok) setGroups(groupActivity(res.recent ?? []));
    });
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  if (!groups) {
    return (
      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Loader2 className="size-3 animate-spin" aria-hidden="true" /> loading activity…
      </p>
    );
  }

  if (groups.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Nothing yet. Everything Fadi does on this machine appears here, including what it was
        refused.
      </p>
    );
  }

  const refusals = groups.filter((g) => g.outcome === "denied");

  return (
    <div className="space-y-3">
      {refusals.length > 0 ? (
        <p className="flex items-center gap-1.5 rounded-md border border-amber-500/40 bg-amber-500/5 p-2.5 text-xs text-amber-500">
          <AlertTriangle className="size-3.5 shrink-0" aria-hidden="true" />
          {refusals.length} refused {refusals.length === 1 ? "attempt" : "attempts"}. Nothing ran.
        </p>
      ) : null}

      <ol className="space-y-1.5">
        {groups.map((group) => (
          <li key={group.id} className="rounded-lg border border-border/60 p-3">
            <details>
              <summary className="cursor-pointer list-none">
                <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                  <span className="text-sm font-medium">{group.title}</span>
                  <span className="text-xs text-muted-foreground">{ACTOR[group.actor] ?? group.actor}</span>
                  <span className={"text-xs " + (TONE[group.outcome] ?? "text-muted-foreground")}>
                    {group.outcome}
                  </span>
                  <span className="ml-auto text-[11px] tabular-nums text-muted-foreground">
                    {new Date(group.at).toLocaleTimeString()}
                  </span>
                </div>
                {group.summary ? (
                  <p className="mt-0.5 text-xs text-muted-foreground">{group.summary}</p>
                ) : null}
              </summary>

              {/* The exact commands, for when "what did it actually run" needs answering
                  rather than inferring. Folded away until asked for. */}
              <ul className="mt-2 space-y-1 border-t border-border/60 pt-2">
                {group.rows.map((r) => (
                  <li key={r.id} className="flex flex-wrap items-baseline gap-2 text-[11px]">
                    <span className={TONE[r.decision] ?? "text-muted-foreground"}>{r.decision}</span>
                    <code className="text-[10px]">{r.command ?? r.capability}</code>
                    {r.detail ? <span className="text-muted-foreground">{r.detail}</span> : null}
                  </li>
                ))}
              </ul>
            </details>
          </li>
        ))}
      </ol>
      {pending ? <p className="text-[11px] text-muted-foreground">updating…</p> : null}
    </div>
  );
}
