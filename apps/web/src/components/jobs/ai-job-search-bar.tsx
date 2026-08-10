"use client";

import { ExternalLink, Globe, Loader2, Sparkles } from "lucide-react";
import { useEffect, useState, useTransition } from "react";

import { aiJobSearch } from "@/app/dashboard/jobs/actions";
import { detectExtension, requestLiveScrape, type LiveJob } from "@/lib/extension/bridge";
import { getCountry } from "@/lib/jobs/locations";
import type { RecommendedJob } from "@/lib/jobs/types";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type LiveState = "idle" | "scraping" | "done" | "error";

// AI-prompt job search: describe the job in plain language → Fadi parses it (scoped to your
// active direction), runs the central job engine, and filters by keywords/salary/exclusions.
// When the Fadi extension is installed, it can ALSO scrape live job portals in your own
// browser session and fold those listings in — the "search Fadi, see the live web" path.
export function AiJobSearchBar() {
  const [prompt, setPrompt] = useState("");
  const [jobs, setJobs] = useState<RecommendedJob[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const [extAvailable, setExtAvailable] = useState(false);
  const [useLive, setUseLive] = useState(true);
  const [liveJobs, setLiveJobs] = useState<LiveJob[] | null>(null);
  const [liveState, setLiveState] = useState<LiveState>("idle");
  const [liveError, setLiveError] = useState<string | null>(null);

  useEffect(() => {
    detectExtension().then(setExtAvailable);
  }, []);

  async function scrapeLive(query: { keywords: string; location?: string; remote?: boolean }) {
    setLiveState("scraping");
    setLiveError(null);
    const res = await requestLiveScrape(query);
    if (!res.ok) {
      setLiveState("error");
      setLiveError(res.error === "timeout" ? "The live scrape timed out." : "Couldn't reach the extension.");
      return;
    }
    setLiveJobs(res.jobs);
    setLiveState("done");
    // Persist into the pipeline (same-origin session cookie works here). Best-effort.
    if (res.jobs.length > 0) {
      try {
        await fetch("/api/extension/capture-batch", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ jobs: res.jobs.slice(0, 60), source: "live-web" }),
        });
      } catch {
        /* display still works even if the save fails */
      }
    }
  }

  function run() {
    if (!prompt.trim()) return;
    setError(null);
    setLiveJobs(null);
    setLiveState("idle");
    start(async () => {
      const res = await aiJobSearch(prompt);
      if (!res.ok) {
        setError(res.message);
        return;
      }
      setJobs(res.jobs);
      if (extAvailable && useLive) {
        const keywords = (res.intent.keywords ?? []).join(" ").trim();
        const location = res.intent.city || getCountry(res.intent.country)?.name || "";
        void scrapeLive({ keywords, location, remote: res.intent.remote });
      }
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

      {extAvailable ? (
        <label className="mt-2 flex cursor-pointer items-center gap-2 text-xs text-muted-foreground">
          <input
            type="checkbox"
            checked={useLive}
            onChange={(e) => setUseLive(e.target.checked)}
            className="size-3.5 accent-primary"
          />
          <Globe className="size-3.5" aria-hidden="true" />
          Also search the live web (LinkedIn / Indeed) in my browser
        </label>
      ) : null}

      {error ? <p className="mt-2 text-xs text-destructive">{error}</p> : null}

      {jobs ? (
        <div className="mt-3 space-y-2">
          <p className="text-xs text-muted-foreground">
            {jobs.length} match{jobs.length === 1 ? "" : "es"} from Fadi&rsquo;s sources
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
              Nothing matched Fadi&rsquo;s sources.{" "}
              {extAvailable && useLive
                ? "The live web scrape below may still find roles."
                : "Try broadening the request, or check the sources below."}
            </p>
          ) : null}
        </div>
      ) : null}

      {/* Live web section — only when the extension is doing / has done a scrape. */}
      {extAvailable && useLive && liveState !== "idle" ? (
        <div className="mt-4 space-y-2 border-t border-border/50 pt-3">
          <div className="flex items-center gap-2 text-xs font-medium">
            <Globe className="size-3.5 text-primary" aria-hidden="true" />
            Live web (scraped in your browser)
          </div>
          {liveState === "scraping" ? (
            <p className="flex items-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="size-3 animate-spin" aria-hidden="true" />
              Opening LinkedIn / Indeed in your session and reading the results…
            </p>
          ) : null}
          {liveState === "error" ? (
            <p className="text-xs text-destructive">{liveError}</p>
          ) : null}
          {liveState === "done" && liveJobs ? (
            liveJobs.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                No live listings found on the portal pages.
              </p>
            ) : (
              <>
                <p className="text-xs text-muted-foreground">
                  {liveJobs.length} live listing{liveJobs.length === 1 ? "" : "s"} — saved to your pipeline.
                </p>
                {liveJobs.slice(0, 20).map((j, i) => (
                  <div
                    key={`${j.title}-${j.company ?? ""}-${i}`}
                    className="rounded-lg border border-primary/30 bg-primary/5 p-2.5 text-sm"
                  >
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
              </>
            )
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
