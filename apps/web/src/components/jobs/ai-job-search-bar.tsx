"use client";

import { ExternalLink, Globe, Loader2, Radio, Sparkles } from "lucide-react";
import { useEffect, useState, useTransition } from "react";

import { aiJobSearch } from "@/app/dashboard/jobs/actions";
import { detectExtension, requestLiveScrape, type LiveJob } from "@/lib/extension/bridge";
import { getCountry } from "@/lib/jobs/locations";
import type { RecommendedJob } from "@/lib/jobs/types";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type LiveState = "idle" | "scraping" | "done" | "error";

const keyOf = (title: string, company?: string | null) => `${title}|${company ?? ""}`.toLowerCase().trim();

// The unified job search. It is SCRAPER-LED: when the extension is present, live portal
// results (LinkedIn/Indeed, scraped in the user's own session) lead the board; Fadi's API
// sources fill in behind as the safety net so the board is never empty. Scoped to the user's
// active career direction, with a global (worldwide) toggle. Deduped across both.
export function AiJobSearchBar({ activeRole }: { activeRole?: string | null }) {
  const [prompt, setPrompt] = useState("");
  const [jobs, setJobs] = useState<RecommendedJob[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const [global, setGlobal] = useState(false);

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
    // Scraper-led: kick off the live scrape immediately (parallel with the API search) so
    // portal results start arriving first.
    start(async () => {
      const res = await aiJobSearch(prompt, { global });
      if (!res.ok) {
        setError(res.message);
        return;
      }
      setJobs(res.jobs);
      if (extAvailable && useLive) {
        const keywords = (res.intent.keywords ?? []).join(" ").trim();
        const location = global ? "" : res.intent.city || getCountry(res.intent.country)?.name || "";
        void scrapeLive({ keywords, location, remote: res.intent.remote });
      }
    });
  }

  // Dedupe the API results against whatever the live scrape already surfaced.
  const liveKeys = new Set((liveJobs ?? []).map((j) => keyOf(j.title, j.company)));
  const apiJobs = (jobs ?? []).filter((j) => !liveKeys.has(keyOf(j.title, j.company)));
  const liveLeads = extAvailable && useLive;

  return (
    <div className="rounded-xl border border-border/60 bg-card p-4">
      <div className="flex items-center gap-2">
        <Sparkles className="size-4 text-primary" aria-hidden="true" />
        <h3 className="text-sm font-semibold">Search jobs</h3>
        {activeRole ? (
          <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary">
            {global ? "Global" : activeRole}
          </span>
        ) : null}
      </div>
      <p className="mt-1 text-xs text-muted-foreground">
        Describe the role in plain language. {liveLeads ? "Live web results (scraped in your browser) lead; " : ""}
        Fadi&rsquo;s sources fill in behind — scoped to your active direction.
      </p>
      <div className="mt-3 flex gap-2">
        <Input
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") run();
          }}
          placeholder="e.g. graduate IT support roles in Dublin"
          aria-label="Describe the job you want"
        />
        <Button onClick={run} disabled={pending || !prompt.trim()}>
          {pending ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
          {pending ? "Searching…" : "Search"}
        </Button>
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1">
        <label className="flex cursor-pointer items-center gap-2 text-xs text-muted-foreground">
          <input
            type="checkbox"
            checked={global}
            onChange={(e) => setGlobal(e.target.checked)}
            className="size-3.5 accent-primary"
          />
          <Globe className="size-3.5" aria-hidden="true" />
          Search worldwide (ignore location)
        </label>
        {extAvailable ? (
          <label className="flex cursor-pointer items-center gap-2 text-xs text-muted-foreground">
            <input
              type="checkbox"
              checked={useLive}
              onChange={(e) => setUseLive(e.target.checked)}
              className="size-3.5 accent-primary"
            />
            <Radio className="size-3.5" aria-hidden="true" />
            Include live web (LinkedIn / Indeed)
          </label>
        ) : null}
      </div>

      {error ? <p className="mt-2 text-xs text-destructive">{error}</p> : null}

      {/* ── Scraper-led: live web results first ── */}
      {liveLeads && liveState !== "idle" ? (
        <div className="mt-3 space-y-2">
          <div className="flex items-center gap-2 text-xs font-medium">
            <Radio className="size-3.5 text-primary" aria-hidden="true" />
            Live web
            {liveState === "done" && liveJobs ? (
              <span className="text-muted-foreground">· {liveJobs.length}</span>
            ) : null}
          </div>
          {liveState === "scraping" ? (
            <p className="flex items-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="size-3 animate-spin" aria-hidden="true" />
              Opening LinkedIn / Indeed in your session and reading the results…
            </p>
          ) : null}
          {liveState === "error" ? <p className="text-xs text-destructive">{liveError}</p> : null}
          {liveState === "done" && liveJobs
            ? liveJobs.slice(0, 20).map((j, i) => (
                <JobRow
                  key={`live-${j.title}-${j.company ?? ""}-${i}`}
                  title={j.title}
                  company={j.company}
                  location={j.location}
                  url={j.url}
                  badge="Live web"
                  accent
                />
              ))
            : null}
        </div>
      ) : null}

      {/* ── Safety net: Fadi's API sources ── */}
      {jobs ? (
        <div className="mt-3 space-y-2">
          <p className="text-xs text-muted-foreground">
            {liveLeads ? "From Fadi’s sources · " : ""}
            {apiJobs.length} match{apiJobs.length === 1 ? "" : "es"}
          </p>
          {apiJobs.slice(0, 12).map((j) => (
            <JobRow key={j.id} title={j.title} company={j.company} location={j.location} url={j.url} badge="Fadi sources" />
          ))}
          {apiJobs.length === 0 && (!liveLeads || liveState === "done") ? (
            <p className="text-xs text-muted-foreground">
              {liveJobs && liveJobs.length > 0
                ? "No extra matches beyond the live results above."
                : "Nothing matched. Try broadening the request or toggling worldwide."}
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function JobRow({
  title,
  company,
  location,
  url,
  badge,
  accent,
}: {
  title: string;
  company?: string | null;
  location?: string | null;
  url?: string | null;
  badge: string;
  accent?: boolean;
}) {
  return (
    <div
      className={`rounded-lg border p-2.5 text-sm ${
        accent ? "border-primary/30 bg-primary/5" : "border-border/50 bg-background/40"
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="font-medium">{title}</span>
        <div className="flex items-center gap-2">
          <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">{badge}</span>
          {url ? (
            <a
              href={url}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-xs text-muted-foreground underline"
            >
              <ExternalLink className="size-3" aria-hidden="true" /> open
            </a>
          ) : null}
        </div>
      </div>
      <p className="text-xs text-muted-foreground">{[company, location].filter(Boolean).join(" · ")}</p>
    </div>
  );
}
