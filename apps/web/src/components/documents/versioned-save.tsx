"use client";

import { AlertTriangle, Check, History, Loader2 } from "lucide-react";
import Link from "next/link";
import { useCallback, useRef, useState } from "react";

import { updateDocumentAction } from "@/app/dashboard/documents/actions";

export type DocumentSaveStatus = "idle" | "saving" | "saved" | "conflict" | "error";

type SaveInput = {
  title?: string;
  content?: string;
  template?: string | null;
};

/**
 * Serializes saves from one editor and sends the server version with each write.
 * The generation counter prevents an older response from marking newer local edits saved.
 */
export function useVersionedDocumentSave(id: string, initialVersion: number) {
  const [status, setStatus] = useState<DocumentSaveStatus>("idle");
  const version = useRef(initialVersion);
  const generation = useRef(0);
  const lastQueuedGeneration = useRef(0);
  const queue = useRef<Promise<void>>(Promise.resolve());
  const conflicted = useRef(false);

  const markDirty = useCallback(() => {
    generation.current += 1;
    if (!conflicted.current) setStatus("idle");
  }, []);

  const save = useCallback(
    (input: SaveInput): Promise<void> => {
      const requestedGeneration = generation.current;
      if (conflicted.current || requestedGeneration <= lastQueuedGeneration.current) {
        return queue.current;
      }
      lastQueuedGeneration.current = requestedGeneration;

      const work = queue.current.then(async () => {
        if (conflicted.current) return;
        setStatus("saving");
        try {
          const result = await updateDocumentAction({
            id,
            expectedVersion: version.current,
            ...input,
          });
          if (result.conflict) {
            conflicted.current = true;
            setStatus("conflict");
            return;
          }
          if (!result.ok || result.version === undefined) {
            if (lastQueuedGeneration.current === requestedGeneration) {
              lastQueuedGeneration.current = requestedGeneration - 1;
            }
            setStatus("error");
            return;
          }

          version.current = result.version;
          setStatus(generation.current === requestedGeneration ? "saved" : "idle");
        } catch {
          if (lastQueuedGeneration.current === requestedGeneration) {
            lastQueuedGeneration.current = requestedGeneration - 1;
          }
          setStatus("error");
        }
      });
      queue.current = work;
      return work;
    },
    [id]
  );

  return { status, markDirty, save };
}

export function DocumentSaveIndicator({ status }: { status: DocumentSaveStatus }) {
  if (status === "saving") {
    return (
      <span className="flex items-center gap-1 text-xs text-muted-foreground">
        <Loader2 className="size-3 animate-spin" aria-hidden="true" /> Saving…
      </span>
    );
  }
  if (status === "saved") {
    return (
      <span className="flex items-center gap-1 text-xs text-muted-foreground">
        <Check className="size-3 text-emerald-400" aria-hidden="true" /> Saved
      </span>
    );
  }
  if (status === "conflict") {
    return (
      <button
        type="button"
        className="flex items-center gap-1 text-xs font-medium text-amber-500 underline-offset-2 hover:underline"
        onClick={() => window.open(window.location.href, "_blank", "noopener,noreferrer")}
        title="Your edits stay in this tab so you can compare or copy them"
      >
        <AlertTriangle className="size-3" aria-hidden="true" /> Changed elsewhere — open latest
      </button>
    );
  }
  if (status === "error") {
    return (
      <span className="flex items-center gap-1 text-xs font-medium text-destructive">
        <AlertTriangle className="size-3" aria-hidden="true" /> Save failed — try again
      </span>
    );
  }
  return <span className="text-xs text-muted-foreground">Autosaves</span>;
}

export function DocumentHistoryLink({ id }: { id: string }) {
  return (
    <Link
      href={`/dashboard/documents/${id}/history`}
      className="inline-flex h-8 items-center justify-center gap-1.5 rounded-md border border-border bg-background px-3 text-xs font-medium transition-colors hover:bg-accent"
    >
      <History className="size-3.5" aria-hidden="true" />
      History
    </Link>
  );
}
