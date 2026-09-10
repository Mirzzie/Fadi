"use client";

import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { approveAction, denyAction } from "@/app/dashboard/learning/permission-actions";
import type { PendingActionView } from "@/app/dashboard/learning/permission-actions";

import { announceActionsChanged } from "./pending-actions";

/** Who asked, in words a person uses rather than the enum stored in the log. */
export const ACTOR_LABEL: Record<string, string> = {
  user: "you",
  model: "the AI model",
  mcp: "an MCP client",
  agent: "a background agent",
};

/** What identifying a host turned up. Mirrors the broker's own type. */
export type Discovered = {
  ip: string;
  name: string | null;
  openPorts: number[];
  guess: { kind: string; virtualization: string; why: string } | null;
};

/**
 * One waiting change.
 *
 * The confirmation strength comes from the policy, not from this component: a reversible
 * container start is a button, and anything irreversible or reaching past a container
 * makes you type its name first. That is not friction for its own sake — it is the
 * difference between an action you chose and one you clicked past on the way to something
 * else.
 */
export function PendingAction({
  w,
  onSettled,
  onDiscovered,
}: {
  w: PendingActionView;
  onSettled: (message: string) => void;
  /** Optional: only surfaces that can act on a discovered machine pass this. */
  onDiscovered?: (d: Discovered) => void;
}) {
  const [typed, setTyped] = useState("");
  const [busy, start] = useTransition();

  const mustType = w.confirm === "type-name";
  const ready = !mustType || typed.trim() === w.confirmToken;

  return (
    <div className="space-y-1.5 rounded border border-border/60 bg-background p-2.5">
      <div className="flex flex-wrap items-center gap-1.5">
        <p className="text-xs font-medium">{w.summary}</p>
        {w.reversibility === "irreversible" ? (
          <span className="rounded-full border border-destructive/50 px-1.5 py-0.5 text-[9px] uppercase tracking-wide text-destructive">
            can&apos;t be undone
          </span>
        ) : w.reversibility === "disruptive" ? (
          <span className="rounded-full border border-amber-500/50 px-1.5 py-0.5 text-[9px] uppercase tracking-wide text-amber-500">
            interrupts something
          </span>
        ) : null}
      </div>

      {/* Verbatim. Approving a description is not approving a command. */}
      {w.argv.map((line) => (
        <pre key={line} className="overflow-x-auto rounded bg-muted px-2 py-1 text-[10px]">
          {line}
        </pre>
      ))}

      {/*
        WHAT THE MACHINE SAYS WILL HAPPEN, as opposed to what the action intends.

        "Start nginx" reads identically whether the image is on disk or about to come down
        a metered connection, and whether the name is free or already taken. These lines
        are that difference, and they are why this is an informed approval rather than a
        polite one.
      */}
      {w.preflight.length > 0 ? (
        <ul className="space-y-0.5">
          {w.preflight.map((note) => (
            <li
              key={note.text}
              className={
                "flex items-start gap-1.5 text-[11px] " +
                (note.kind === "warn"
                  ? "text-amber-500"
                  : note.kind === "unknown"
                    ? "text-muted-foreground italic"
                    : "text-muted-foreground")
              }
            >
              <span aria-hidden="true">{note.kind === "warn" ? "!" : note.kind === "unknown" ? "?" : "·"}</span>
              <span>{note.text}</span>
            </li>
          ))}
        </ul>
      ) : null}

      <p className="text-[11px] text-muted-foreground">
        Asked by {ACTOR_LABEL[w.actor] ?? w.actor}
        {w.origin ? " (" + w.origin + ")" : ""}.
        {w.reversal ? " " + w.reversal : ""}
      </p>

      {mustType ? (
        <div className="space-y-1">
          <label className="block text-[11px] text-muted-foreground" htmlFor={"confirm-" + w.id}>
            Type <span className="font-mono text-foreground">{w.confirmToken}</span> to allow this.
          </label>
          <input
            id={"confirm-" + w.id}
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            autoComplete="off"
            spellCheck={false}
            className="h-7 w-full max-w-xs rounded border border-border bg-background px-2 font-mono text-[11px]"
            placeholder={w.confirmToken}
          />
        </div>
      ) : null}

      <div className="flex items-center gap-2">
        <Button
          size="sm"
          disabled={busy || !ready}
          onClick={() =>
            start(async () => {
              const res = await approveAction({ requestId: w.id, confirmation: typed });
              onSettled(res.ok ? "Done. " + (res.message ?? "") : (res.message ?? "It didn't run."));
              // Every surface showing this queue hears about it, so the prompt does not
              // linger on one screen after being answered on another.
              announceActionsChanged();
              // A machine that answered is worth offering to record while it is in front
              // of the person, rather than leaving them to type it in somewhere else later.
              if (res.ok && res.discovered) onDiscovered?.(res.discovered);
            })
          }
        >
          Run it
        </Button>
        <Button
          size="sm"
          variant="ghost"
          disabled={busy}
          onClick={() =>
            start(async () => {
              await denyAction({ requestId: w.id });
              onSettled("Declined. Nothing ran.");
              announceActionsChanged();
            })
          }
        >
          No
        </Button>
        {/*
          The age, not the deadline.

          Most prompts no longer expire — a decision should not be thrown away because the
          user went to look at something else, and staleness of the EFFECT is re-checked at
          approval instead. But "this was asked three days ago" is something the approver
          needs and no amount of freshness-checking supplies it.
        */}
        <span className="text-[10px] text-muted-foreground">Asked {w.askedAgo}</span>
      </div>
    </div>
  );
}


