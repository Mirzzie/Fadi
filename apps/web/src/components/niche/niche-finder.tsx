"use client";

import {
  AlertTriangle,
  ArrowRight,
  Check,
  Compass,
  Gauge,
  Loader2,
  Sparkles,
  TrendingUp,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { findNichesAction, type NicheFinderActionResult } from "@/app/dashboard/niche-finder/actions";
import { createTrackAction } from "@/app/dashboard/tracks/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

type Result = Extract<NicheFinderActionResult, { ok: true }>["result"];
type Niche = Result["niches"][number];

const COMPETITION_LABEL: Record<string, string> = {
  low: "Low",
  moderate: "Moderate",
  high: "High",
  very_high: "Very high",
};

const COMPETITION_TONE: Record<string, string> = {
  low: "text-emerald-400",
  moderate: "text-sky-400",
  high: "text-amber-400",
  very_high: "text-rose-400",
};

export function NicheFinder() {
  const [situation, setSituation] = useState("");
  const [interests, setInterests] = useState("");
  const [constraints, setConstraints] = useState("");
  const [location, setLocation] = useState("");
  const [candidates, setCandidates] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [pending, startTransition] = useTransition();

  function run() {
    setError(null);
    startTransition(async () => {
      const res = await findNichesAction({
        situation,
        interests,
        constraints,
        location,
        candidateNiches: candidates
          .split(/[,\n]/)
          .map((s) => s.trim())
          .filter(Boolean),
      });
      if (!res.ok) {
        setError(res.message);
        return;
      }
      setResult(res.result);
    });
  }

  if (result) {
    return <Results result={result} onReset={() => setResult(null)} />;
  }

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <header className="space-y-1">
        <div className="flex items-center gap-2">
          <Compass className="size-5 text-primary" aria-hidden="true" />
          <h1 className="font-heading text-xl font-semibold tracking-tight">Niche Finder</h1>
        </div>
        <p className="text-sm text-muted-foreground">
          Torn between paths? Tell me where you stand. I&apos;ll pull live demand data and give you the
          honest reality on each option — demand, pay, competition, the real time and money to break
          in, and your odds — so you stop guessing.
        </p>
      </header>

      <div className="space-y-4 rounded-2xl border border-border/60 bg-card/60 p-5">
        <div className="space-y-1.5">
          <Label htmlFor="nf-situation">Where are you right now?</Label>
          <Textarea
            id="nf-situation"
            rows={4}
            placeholder="2 years in retail ops, a commerce degree, decent with spreadsheets and people. I want something more stable and better paid but I'm not sure what fits."
            value={situation}
            onChange={(e) => setSituation(e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="nf-candidates">Niches you&apos;re torn between (optional)</Label>
          <Input
            id="nf-candidates"
            placeholder="Financial analyst, Data analyst, Accounting — or leave blank and I'll suggest"
            value={candidates}
            onChange={(e) => setCandidates(e.target.value)}
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="nf-interests">What pulls you? (optional)</Label>
            <Input
              id="nf-interests"
              placeholder="Numbers, structure, no late nights"
              value={interests}
              onChange={(e) => setInterests(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="nf-location">Location</Label>
            <Input
              id="nf-location"
              placeholder="Dublin, Ireland / Remote"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
            />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="nf-constraints">Constraints (optional)</Label>
          <Input
            id="nf-constraints"
            placeholder="6 months of savings, can study ~10h/week, need income within a year"
            value={constraints}
            onChange={(e) => setConstraints(e.target.value)}
          />
        </div>

        {error ? (
          <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </p>
        ) : null}

        <Button onClick={run} disabled={pending || situation.trim().length < 20} className="w-full">
          {pending ? (
            <>
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              Pulling live data &amp; weighing your options…
            </>
          ) : (
            <>
              <Sparkles className="size-4" aria-hidden="true" />
              Find my niche
            </>
          )}
        </Button>
        {pending ? (
          <p className="text-center text-xs text-muted-foreground">
            Fetching real postings for each option and grounding the verdict — this takes ~15–30s.
          </p>
        ) : null}
      </div>
    </div>
  );
}

function Results({ result, onReset }: { result: Result; onReset: () => void }) {
  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Compass className="size-5 text-primary" aria-hidden="true" />
          <h1 className="font-heading text-xl font-semibold tracking-tight">Your niche reality check</h1>
        </div>
        <Button variant="ghost" size="sm" onClick={onReset}>
          Start over
        </Button>
      </div>

      <div className="rounded-2xl border border-border/60 bg-card/60 p-5">
        <p className="text-sm leading-relaxed">{result.overview}</p>
      </div>

      <div className="space-y-4">
        {result.niches.map((n, i) => (
          <NicheCard key={n.name} niche={n} rank={i + 1} />
        ))}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-2xl border border-primary/30 bg-primary/5 p-5">
          <p className="mb-1 flex items-center gap-1.5 text-sm font-semibold text-primary">
            <TrendingUp className="size-4" aria-hidden="true" /> Recommendation
          </p>
          <p className="text-sm leading-relaxed">{result.recommendation}</p>
        </div>
        <div className="rounded-2xl border border-amber-500/30 bg-amber-500/5 p-5">
          <p className="mb-1 flex items-center gap-1.5 text-sm font-semibold text-amber-400">
            <AlertTriangle className="size-4" aria-hidden="true" /> Reality check
          </p>
          <p className="text-sm leading-relaxed">{result.realityCheck}</p>
        </div>
      </div>

      {result.laborBackdrop ? (
        <p className="text-center text-xs text-muted-foreground">{result.laborBackdrop}</p>
      ) : null}
    </div>
  );
}

function NicheCard({ niche, rank }: { niche: Niche; rank: number }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [started, setStarted] = useState(false);

  function startAsTrack() {
    startTransition(async () => {
      const targetRole = niche.evidence.sampleRoles[0] ?? niche.name;
      const res = await createTrackAction({
        label: niche.name,
        targetRole,
        domain: niche.domain || undefined,
        intent: "career",
        careerGoal: `Break into ${niche.name}. ${niche.pathway.map((p) => p.step).join(" → ")}`.slice(0, 1900),
      });
      if (res.ok) {
        setStarted(true);
        router.refresh();
      }
    });
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-border/60 bg-card/60">
      <div className="flex items-start justify-between gap-3 border-b border-border/50 p-5">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="grid size-5 shrink-0 place-items-center rounded-full bg-primary/15 text-[0.7rem] font-bold text-primary">
              {rank}
            </span>
            <h2 className="truncate text-base font-semibold">{niche.name}</h2>
            <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[0.7rem] text-muted-foreground">
              {niche.domain}
            </span>
          </div>
          <p className="mt-1.5 text-sm leading-relaxed">{niche.verdict}</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-px bg-border/40 sm:grid-cols-4">
        <Stat icon={<Gauge className="size-3.5" />} label="Fit" value={`${niche.fitScore}`} suffix="/100" />
        <Stat
          icon={<TrendingUp className="size-3.5" />}
          label="Odds (12mo)"
          value={`${niche.successProbability}`}
          suffix="%"
        />
        <Stat label="Competition" valueClass={COMPETITION_TONE[niche.competition]} value={COMPETITION_LABEL[niche.competition] ?? niche.competition} />
        <Stat label="Live postings" value={`${niche.evidence.livePostingsSeen}`} />
      </div>

      <div className="space-y-4 p-5">
        <div className="grid gap-3 text-sm sm:grid-cols-3">
          <Field label="Demand" value={niche.demand} />
          <Field label="Pay" value={niche.payRange} />
          <Field label="Time to break in" value={niche.timeToBreakIn} />
        </div>
        <Field label="Estimated cost" value={niche.estimatedCost} />

        <div className="grid gap-4 sm:grid-cols-2">
          {niche.transferableStrengths.length ? (
            <div>
              <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-emerald-400">
                Carries over
              </p>
              <ul className="space-y-1 text-sm">
                {niche.transferableStrengths.map((s, i) => (
                  <li key={i} className="flex gap-1.5">
                    <Check className="mt-0.5 size-3.5 shrink-0 text-emerald-400" aria-hidden="true" />
                    {s}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          {niche.gaps.length ? (
            <div>
              <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-amber-400">
                Real gaps
              </p>
              <ul className="space-y-1 text-sm">
                {niche.gaps.map((g, i) => (
                  <li key={i} className="flex gap-1.5">
                    <ArrowRight className="mt-0.5 size-3.5 shrink-0 text-amber-400" aria-hidden="true" />
                    {g}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>

        {niche.pathway.length ? (
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Pathway
            </p>
            <ol className="space-y-2">
              {niche.pathway.map((p, i) => (
                <li key={i} className="flex gap-2.5 text-sm">
                  <span className="grid size-5 shrink-0 place-items-center rounded-full border border-border/60 text-[0.7rem] text-muted-foreground">
                    {i + 1}
                  </span>
                  <span>
                    <span className="font-medium">{p.step}</span>
                    {p.detail ? <span className="text-muted-foreground"> — {p.detail}</span> : null}
                  </span>
                </li>
              ))}
            </ol>
          </div>
        ) : null}

        {niche.evidence.sampleRoles.length || niche.evidence.salarySamples.length ? (
          <details className="rounded-lg border border-border/50 bg-background/40 px-3 py-2 text-xs text-muted-foreground">
            <summary className="cursor-pointer select-none font-medium">
              Evidence behind this verdict
            </summary>
            <div className="mt-2 space-y-1">
              {niche.evidence.sampleRoles.length ? (
                <p>Real roles seen: {niche.evidence.sampleRoles.join("; ")}</p>
              ) : null}
              {niche.evidence.salarySamples.length ? (
                <p>Salary signals: {niche.evidence.salarySamples.join(" | ")}</p>
              ) : null}
              {niche.evidence.sources.length ? <p>Sources: {niche.evidence.sources.join(", ")}</p> : null}
            </div>
          </details>
        ) : null}

        <div className="flex justify-end pt-1">
          {started ? (
            <span className="flex items-center gap-1.5 text-sm text-emerald-400">
              <Check className="size-4" aria-hidden="true" /> Track created — switch to it from the top bar
            </span>
          ) : (
            <Button variant="outline" size="sm" onClick={startAsTrack} disabled={pending}>
              {pending ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : null}
              Start this as a track
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

function Stat({
  icon,
  label,
  value,
  suffix,
  valueClass,
}: {
  icon?: React.ReactNode;
  label: string;
  value: string;
  suffix?: string;
  valueClass?: string;
}) {
  return (
    <div className="bg-card/60 p-3 text-center">
      <p className={cn("text-lg font-semibold tabular-nums", valueClass)}>
        {value}
        {suffix ? <span className="text-xs text-muted-foreground">{suffix}</span> : null}
      </p>
      <p className="flex items-center justify-center gap-1 text-[0.7rem] uppercase tracking-wide text-muted-foreground">
        {icon}
        {label}
      </p>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-0.5 leading-relaxed">{value}</p>
    </div>
  );
}
