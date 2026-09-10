"use client";

import { ShieldAlert } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

import { PendingAction } from "./pending-action-card";
import { usePendingActions } from "./pending-actions";

/**
 * THINGS WAITING ON A DECISION, VISIBLE FROM ANYWHERE.
 *
 * Separate from the notification bell on purpose, and the distinction is the point. The
 * bell is a feed: things that happened, which you read when you feel like it. This is a
 * queue of things that have NOT happened and cannot until you answer. Filing a blocking
 * decision into a stream of notifications is how it gets scrolled past.
 *
 * It is absent when the queue is empty rather than showing a zero. A permanent badge
 * reading "0" is furniture, and furniture is what people stop seeing.
 */
export function ApprovalCenter() {
  const { pending } = usePendingActions();
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  if (pending.length === 0) return null;

  // Anything that cannot be undone raises the volume of the indicator itself, so the
  // difference between "start a container" and "delete this" is visible before opening it.
  const grave = pending.some((p) => p.reversibility === "irreversible");

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        aria-label={pending.length + " waiting for your approval"}
        className={
          "flex items-center gap-1.5 rounded-full border px-2.5 py-1 font-medium transition-colors " +
          (grave
            ? "border-destructive/60 bg-destructive/10 text-destructive hover:bg-destructive/20"
            : "border-primary/60 bg-primary/10 text-primary hover:bg-primary/20")
        }
      >
        <ShieldAlert className="size-3.5" aria-hidden="true" />
        <span className="tabular-nums">{pending.length}</span>
        <span className="hidden sm:inline">waiting</span>
      </PopoverTrigger>

      <PopoverContent align="end" className="w-[26rem] max-w-[92vw] space-y-2 p-3">
        <div className="flex items-baseline justify-between">
          <p className="text-xs font-semibold">Waiting for you</p>
          <Link
            href="/dashboard/learning"
            className="text-[11px] text-muted-foreground underline-offset-2 hover:underline"
            onClick={() => setOpen(false)}
          >
            Machine access
          </Link>
        </div>

        <p className="text-[11px] text-muted-foreground">
          Nothing here has run. Fadi is asking.
        </p>

        {pending.map((w) => (
          <PendingAction key={w.id} w={w} onSettled={setNote} />
        ))}

        {note ? <p className="text-[11px] text-muted-foreground">{note}</p> : null}
      </PopoverContent>
    </Popover>
  );
}
