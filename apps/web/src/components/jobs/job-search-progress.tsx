"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

/** Shape mirrors JobSyncStatus in lib/jobs/sync.ts (server-only), kept local so this
 *  client component never imports the server module. */
export type SyncProgress = {
  running: boolean;
  startedAt: number;
  finishedAt: number | null;
  found: number;
  sources: Array<{ id: string; count: number }>;
  done: number;
  total: number;
};

const POLL_MS = 4000;
const JUST_DONE_MS = 8000;

/**
 * Live banner for the background web crawl. While a run is active it refreshes the
 * board every few seconds so freshly-crawled roles surface as they land — the design
 * choice is accuracy over speed, so the user SEES the search working instead of an
 * empty-but-instant board. Renders nothing when nothing is happening.
 */
export function JobSearchProgress({ status }: { status: SyncProgress | null }) {
  const router = useRouter();
  const [showComplete, setShowComplete] = useState(false);
  const wasRunning = useRef(false);

  const running = status?.running ?? false;

  // While a run is active, re-run the server component every few seconds so new rows +
  // the latest status appear without the user reloading.
  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => router.refresh(), POLL_MS);
    return () => clearInterval(id);
  }, [running, router]);

  // On the running -> done transition, pull the final results once and flash a brief
  // "complete" note. Gating on the transition (not wall-clock) keeps a stale finished
  // status from showing the note on an ordinary page load.
  useEffect(() => {
    const prev = wasRunning.current;
    wasRunning.current = running;
    if (prev && !running) {
      router.refresh();
      setShowComplete(true);
      const id = setTimeout(() => setShowComplete(false), JUST_DONE_MS);
      return () => clearTimeout(id);
    }
  }, [running, router]);

  if (!status) return null;
  if (!running && !showComplete) return null;

  // RAW fetched-so-far across sources — pre-dedupe, pre-filter, pre-persist. Labelled
  // "fetched" (not "found") precisely because it's larger than what lands on the board.
  const fetchedSoFar = status.sources.reduce((n, s) => n + s.count, 0);

  return (
    <div
      role="status"
      aria-live="polite"
      className={`flex flex-col gap-1 rounded-lg border px-4 py-3 text-sm ${
        running
          ? "border-teal-500/30 bg-teal-500/5 text-teal-50"
          : "border-emerald-500/30 bg-emerald-500/5 text-emerald-50"
      }`}
    >
      <div className="flex items-center gap-2.5">
        {running ? (
          <span
            aria-hidden
            className="h-2 w-2 shrink-0 animate-pulse rounded-full bg-teal-400 motion-reduce:animate-none"
          />
        ) : (
          <span aria-hidden className="h-2 w-2 shrink-0 rounded-full bg-emerald-400" />
        )}
        <span className="font-medium">
          {running
            ? "Fadi is searching the web for roles"
            : `Search complete — ${status.found} new role${status.found === 1 ? "" : "s"} added`}
        </span>
        {running && status.total > 0 && (
          <span className="text-teal-200/70">
            {status.done}/{status.total} sources scanned · {fetchedSoFar} fetched
          </span>
        )}
      </div>
      {running && (
        <p className="pl-4.5 text-xs text-teal-200/60">
          This runs in the background and can take a minute. The board updates once the search
          finishes — results are deduplicated and ranked first. No need to wait.
        </p>
      )}
    </div>
  );
}
