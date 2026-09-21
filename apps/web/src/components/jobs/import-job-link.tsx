"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Link2, Loader2 } from "lucide-react";

import { importJobFromUrlAction, type ImportedJob } from "@/app/dashboard/jobs/import-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

/**
 * Bring in a job Fadi did not find.
 *
 * Discovery misses roles — for Ireland only two of the configured providers return anything at
 * all. When somebody finds a posting themselves, pasting the link reads that page and puts the
 * real posting on their board, with its description, so every later step (fit, CV review,
 * interview practice) has the actual text to work from.
 */
export function ImportJobLink() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState("");
  const [imported, setImported] = useState<ImportedJob | null>(null);
  const [error, setError] = useState<{ message: string; manual?: boolean } | null>(null);
  const [pending, start] = useTransition();

  function run() {
    if (!url.trim()) return;
    setError(null);
    setImported(null);
    start(async () => {
      const result = await importJobFromUrlAction({ url });
      if (!result.ok) return setError({ message: result.message, manual: result.manual });
      setImported(result.job);
      setUrl("");
      router.refresh();
    });
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
      >
        <Link2 className="size-3.5" aria-hidden="true" />
        Add a job by link
      </button>
    );
  }

  return (
    <div className="w-full space-y-2 rounded-lg border border-border/60 p-3">
      <p className="text-xs text-muted-foreground">
        Paste the link to a job posting. Fadi reads what the page states — title, company,
        location, description — and adds it to your board.
      </p>
      <div className="flex flex-wrap gap-2">
        <Input
          value={url}
          onChange={(event) => setUrl(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") run();
          }}
          placeholder="https://…"
          aria-label="Job posting link"
          className="min-w-56 flex-1"
        />
        <Button onClick={run} disabled={pending || !url.trim()}>
          {pending ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : null}
          {pending ? "Reading…" : "Add job"}
        </Button>
        <Button variant="ghost" onClick={() => setOpen(false)} disabled={pending}>
          Cancel
        </Button>
      </div>

      {imported ? (
        <p className="text-xs">
          Added <span className="font-medium">{imported.title}</span> at {imported.company}
          {imported.location ? ` — ${imported.location}` : ""}.{" "}
          {imported.hasDescription ? "" : "The page gave no description, so add it by hand for a tailored CV. "}
          <Link
            href={`/dashboard/applications/${imported.jobId}/workspace`}
            className="font-medium text-primary hover:underline"
          >
            Open it
          </Link>
        </p>
      ) : null}

      {error ? (
        <p className="text-xs text-amber-500">
          {error.message}{" "}
          {error.manual ? (
            <Link href="/dashboard/applications" className="font-medium underline">
              Add it by hand
            </Link>
          ) : null}
        </p>
      ) : null}
    </div>
  );
}
