"use client";

import { useState, useTransition, type CSSProperties } from "react";
import { Activity, Check, Moon, Pencil } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  setCommitmentCadence,
  startRestPeriod,
  type CadencePeriod,
} from "@/app/dashboard/momentum-actions";

export type MomentumView = {
  score: number;
  band: "dormant" | "warming" | "building" | "strong" | "peak";
  bandMessage: string;
  isResting: boolean;
  cadenceTarget: number | null;
  cadencePeriod: string;
  cadenceMessage: string;
  qualityApplicationsThisPeriod: number;
};

const BAND_META: Record<MomentumView["band"], { label: string; color: string }> = {
  // Never alarm-red. Low momentum is warm/neutral, not a failure signal.
  dormant: { label: "Dormant", color: "var(--muted-foreground)" },
  warming: { label: "Warming up", color: "var(--chart-4)" },
  building: { label: "Building", color: "var(--chart-1)" },
  strong: { label: "Strong", color: "var(--primary)" },
  peak: { label: "Peak", color: "var(--primary)" },
};

const CADENCE_OPTIONS: Record<CadencePeriod, number[]> = {
  week: [1, 2, 3, 5],
  day: [1, 2, 3],
};

export function MomentumPanel({ momentum }: { momentum: MomentumView }) {
  const [pending, startTransition] = useTransition();
  const [editing, setEditing] = useState(momentum.cadenceTarget == null);
  const [period, setPeriod] = useState<CadencePeriod>(
    momentum.cadencePeriod === "day" ? "day" : "week",
  );
  const [target, setTarget] = useState<number>(momentum.cadenceTarget ?? 2);
  const [feedback, setFeedback] = useState<string | null>(null);

  function commitCadence() {
    setFeedback(null);
    startTransition(async () => {
      const res = await setCommitmentCadence({ target, period });
      setFeedback(res.message);
      if (res.ok) setEditing(false);
    });
  }

  function rest(days: number) {
    setFeedback(null);
    startTransition(async () => {
      const res = await startRestPeriod({ days });
      setFeedback(res.message);
    });
  }

  return (
    <section
      className="glow-dynamic relative overflow-hidden rounded-xl border border-dynamic bg-card transition-shadow duration-700"
      style={{ "--accent-dynamic": BAND_META[momentum.band].color } as CSSProperties}
    >
      <div className="grid gap-px bg-border md:grid-cols-[auto_1fr]">
        {/* ── Momentum ring ── */}
        <div className="flex flex-col items-center justify-center gap-3 bg-card p-6 md:w-64">
          <MomentumRing score={momentum.score} band={momentum.band} />
          <p className="max-w-[16rem] text-center text-sm text-muted-foreground">
            {momentum.bandMessage}
          </p>
        </div>

        {/* ── Cadence + rest ── */}
        <div className="space-y-5 bg-card p-6">
          <div>
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-sm font-semibold">Your commitment</h3>
              {momentum.cadenceTarget != null && !editing ? (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setEditing(true)}
                  className="text-muted-foreground"
                >
                  <Pencil className="size-3.5" aria-hidden="true" />
                  Adjust
                </Button>
              ) : null}
            </div>

            {momentum.cadenceTarget != null && !editing ? (
              <CadenceProgress momentum={momentum} />
            ) : (
              <CadencePicker
                period={period}
                target={target}
                onPeriod={(p) => {
                  setPeriod(p);
                  if (!CADENCE_OPTIONS[p].includes(target)) setTarget(CADENCE_OPTIONS[p][0]);
                }}
                onTarget={setTarget}
                onCommit={commitCadence}
                pending={pending}
              />
            )}
          </div>

          <div className="border-t pt-4">
            <h3 className="text-sm font-semibold">
              {momentum.isResting ? "You're resting" : "Need a breather?"}
            </h3>
            {momentum.isResting ? (
              <p className="mt-1.5 flex items-start gap-2 text-sm text-muted-foreground">
                <Moon className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
                Rest is on. Your momentum is paused and preserved — no decay, no catch-up debt.
              </p>
            ) : (
              <>
                <p className="mt-1.5 text-sm text-muted-foreground">
                  Rest is part of the work, not a lapse. Protect some time — momentum is preserved
                  while you&apos;re away.
                </p>
                <div className="mt-2.5 flex flex-wrap gap-2">
                  {[
                    { days: 1, label: "A day" },
                    { days: 3, label: "3 days" },
                    { days: 7, label: "A week" },
                  ].map((opt) => (
                    <Button
                      key={opt.days}
                      variant="outline"
                      size="sm"
                      onClick={() => rest(opt.days)}
                      disabled={pending}
                    >
                      <Moon className="size-3.5" aria-hidden="true" />
                      {opt.label}
                    </Button>
                  ))}
                </div>
              </>
            )}
          </div>

          {feedback ? <p className="text-xs text-muted-foreground">{feedback}</p> : null}
        </div>
      </div>
    </section>
  );
}

function MomentumRing({ score, band }: { score: number; band: MomentumView["band"] }) {
  const meta = BAND_META[band];
  const r = 52;
  const c = 2 * Math.PI * r;
  // Never visually empty — momentum is never zero, so neither is the ring.
  const pct = Math.max(4, Math.min(100, score));
  const offset = c * (1 - pct / 100);

  return (
    <div className="relative grid place-items-center">
      {/* Band-coloured glow — intensifies as momentum builds */}
      <div
        className="pointer-events-none absolute size-28 rounded-full blur-2xl transition-opacity duration-700"
        style={{ background: meta.color, opacity: 0.08 + (pct / 100) * 0.22 }}
        aria-hidden="true"
      />
      <svg width={132} height={132} viewBox="0 0 132 132" className="relative -rotate-90">
        <circle cx={66} cy={66} r={r} fill="none" stroke="var(--muted)" strokeWidth={10} />
        <circle
          cx={66}
          cy={66}
          r={r}
          fill="none"
          stroke={meta.color}
          strokeWidth={10}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={offset}
          style={{ transition: "stroke-dashoffset 700ms ease" }}
        />
      </svg>
      <div className="absolute flex flex-col items-center">
        <Activity className="mb-0.5 size-4 text-muted-foreground" aria-hidden="true" />
        <span className="text-3xl font-semibold tabular-nums leading-none">
          {Math.round(score)}
        </span>
        <span className="mt-1 text-xs font-medium" style={{ color: meta.color }}>
          {meta.label}
        </span>
      </div>
    </div>
  );
}

function CadenceProgress({ momentum }: { momentum: MomentumView }) {
  const target = momentum.cadenceTarget ?? 0;
  const done = momentum.qualityApplicationsThisPeriod;
  const pct = target > 0 ? Math.min(100, (done / target) * 100) : 0;

  return (
    <div className="mt-2 space-y-2">
      <div className="flex items-baseline justify-between">
        <span className="text-sm text-muted-foreground">
          Quality applications this {momentum.cadencePeriod}
        </span>
        <span className="text-sm font-medium tabular-nums">
          {done} / {target}
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full bg-primary transition-all duration-700"
          style={{ width: `${Math.max(done > 0 ? 4 : 0, pct)}%` }}
        />
      </div>
      <p className="text-xs text-muted-foreground">{momentum.cadenceMessage}</p>
    </div>
  );
}

function CadencePicker({
  period,
  target,
  onPeriod,
  onTarget,
  onCommit,
  pending,
}: {
  period: CadencePeriod;
  target: number;
  onPeriod: (p: CadencePeriod) => void;
  onTarget: (n: number) => void;
  onCommit: () => void;
  pending: boolean;
}) {
  return (
    <div className="mt-2 space-y-3">
      <p className="text-sm text-muted-foreground">
        What feels <span className="text-foreground">sustainable</span> — not ambitious? A small
        commitment you keep beats a big one you can&apos;t.
      </p>

      <div className="flex flex-wrap items-center gap-2">
        {CADENCE_OPTIONS[period].map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => onTarget(n)}
            className={cn(
              "min-w-9 rounded-full border px-3 py-1 text-sm tabular-nums transition-colors",
              target === n
                ? "border-primary bg-primary/10 text-primary"
                : "border-border text-muted-foreground hover:border-primary/50",
            )}
          >
            {n}
          </button>
        ))}
        <span className="text-sm text-muted-foreground">per</span>
        <div className="flex overflow-hidden rounded-full border">
          {(["week", "day"] as CadencePeriod[]).map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => onPeriod(p)}
              className={cn(
                "px-3 py-1 text-sm transition-colors",
                period === p
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-muted",
              )}
            >
              {p}
            </button>
          ))}
        </div>
      </div>

      <Button size="sm" onClick={onCommit} disabled={pending}>
        <Check className="size-4" aria-hidden="true" />
        Commit to this
      </Button>
    </div>
  );
}
