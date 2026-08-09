"use client";

import { ExternalLink, Loader2, Sparkles } from "lucide-react";
import { useState, useTransition } from "react";

import { aiJobSearch } from "@/app/dashboard/jobs/actions";
import type { RecommendedJob } from "@/lib/jobs/types";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

// AI-prompt job search: describe the job in plain language → Fadi parses it (scoped to your
// active direction), runs the central job engine, and filters by keywords/salary/exclusions.
export function AiJobSearchBar() {
  const [prompt, setPrompt] = useState("");
  const [jobs, setJobs] = useState<RecommendedJob[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function run() {
    if (!prompt.trim()) return;
    setError(null);
    start(async () => {
      const res = await aiJobSearch(prompt);
      if (res.ok) setJobs(res.jobs);
      else setError(res.message);
    });
  }

  return (
    <div className="rounded-xl border border-border/60 bg-card p-4">
      <div className="flex items-center gap-2">
        <Sparkles className="size-4 text-primary" aria-hidden="true" />
        <h3 className="text-sm font-semibold">Ask Fadi for jobs</h3>
      </div>
      <p className="mt-1 text-xs text-muted-foreground">
        e.g. &ldquo;remote senior DevOps roles in Germany, €80k+, no crypto&rdquo; — searched
        across every source, scoped to your active direction.
      </p>
      <div className="mt-3 flex gap-2">
        <Input
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") run();
          }}
          placeholder="Describe the job you want…"
          aria-label="Describe the job you want"
        />
        <Button onClick={run} disabled={pending || !prompt.trim()}>
          {pending ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
          {pending ? "Searching…" : "Search"}
        </Button>
      </div>

      {error ? <p className="mt-2 text-xs text-destructive">{error}</p> : null}

      {jobs ? (
        <div className="mt-3 space-y-2">
          <p className="text-xs text-muted-foreground">
            {jobs.length} match{jobs.length === 1 ? "" : "es"}
          </p>
          {jobs.slice(0, 12).map((j) => (
            <div key={j.id} className="rounded-lg border border-border/50 bg-background/40 p-2.5 text-sm">
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium">{j.title}</span>
                {j.url ? (
                  <a
                    href={j.url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-xs text-muted-foreground underline"
                  >
                    <ExternalLink className="size-3" aria-hidden="true" /> open
                  </a>
                ) : null}
              </div>
              <p className="text-xs text-muted-foreground">
                {[j.company, j.location].filter(Boolean).join(" · ")}
              </p>
            </div>
          ))}
          {jobs.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              Nothing matched. Try broadening the request, or check the sources below.
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
