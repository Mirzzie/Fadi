"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { ArrowRight, Check, Loader2, Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  addStepAction,
  setGoalAction,
  setStepStatusAction,
  switchGoalAction,
} from "@/app/dashboard/work-actions";
import type { Today } from "@/lib/work/today";

/**
 * The first screen, answering four questions in order: what am I trying to achieve, what do I
 * do next, what has Fadi been doing, what needs my decision.
 *
 * Nothing here is filler. A section with no honest answer says it has none, because a page that
 * always looks busy teaches you to stop reading it.
 */
export function TodayView({ today }: { today: Today }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function run(action: () => Promise<{ ok: boolean; error?: string }>) {
    setError(null);
    start(async () => {
      const result = await action();
      if (!result.ok) setError(result.error ?? "Could not save that.");
      else router.refresh();
    });
  }

  return (
    <div className="mx-auto max-w-shell space-y-4 pb-10">
      <header className="pt-1">
        <h1 className="text-xl font-semibold tracking-tight">Hey {today.firstName}.</h1>
      </header>

      <Working today={today} pending={pending} onRun={run} />
      <NextAction today={today} pending={pending} onRun={run} />
      <Decisions today={today} />
      <WhatFadiDid today={today} />
      <Suggestions today={today} />

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      <p className="pt-1 text-xs text-muted-foreground">
        <Link href="/dashboard/overview" className="underline underline-offset-4">
          See the full picture
        </Link>{" "}
        — market signals, momentum and your career report.
      </p>
    </div>
  );
}

type Runner = (action: () => Promise<{ ok: boolean; error?: string }>) => void;

function Section({
  title,
  aside,
  children,
}: {
  title: string;
  aside?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border border-border bg-card/40 p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
          {title}
        </h2>
        {aside}
      </div>
      <div className="mt-3">{children}</div>
    </section>
  );
}

function Working({ today, pending, onRun }: { today: Today; pending: boolean; onRun: Runner }) {
  const [naming, setNaming] = useState(false);
  const [title, setTitle] = useState("");

  return (
    <Section
      title="Working towards"
      aside={
        today.goal.source === "goal" ? (
          <Button variant="ghost" size="xs" onClick={() => setNaming((v) => !v)}>
            Change
          </Button>
        ) : null
      }
    >
      {today.goal.source === "none" && !naming ? (
        <div className="flex flex-wrap items-center gap-3">
          <p className="text-sm text-muted-foreground">
            Nothing set. Say what you are working towards and Fadi will keep the rest pointed at it.
          </p>
          <Button size="sm" onClick={() => setNaming(true)}>
            Set a goal
          </Button>
        </div>
      ) : (
        <>
          <p className="text-lg font-medium">{today.goal.title}</p>
          {today.goal.reason ? (
            <p className="mt-1 text-sm text-muted-foreground">{today.goal.reason}</p>
          ) : null}
          {today.goal.source === "direction" ? (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <span className="text-xs text-muted-foreground">
                This is your active direction. Set a goal to make it something you can finish.
              </span>
              <Button variant="outline" size="xs" onClick={() => setNaming(true)}>
                Set a goal
              </Button>
            </div>
          ) : null}
        </>
      )}

      {naming ? (
        <form
          className="mt-3 flex flex-wrap gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            const value = title;
            setTitle("");
            setNaming(false);
            onRun(() => setGoalAction(value));
          }}
        >
          <input
            autoFocus
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="Land a cloud support role in Dublin"
            className="min-w-0 flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm"
          />
          <Button type="submit" size="sm" disabled={pending || !title.trim()}>
            Save
          </Button>
        </form>
      ) : null}

      {today.otherGoals.length > 0 ? (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className="text-xs text-muted-foreground">Also going on:</span>
          {today.otherGoals.map((goal) => (
            <Button
              key={goal.id}
              variant="outline"
              size="xs"
              disabled={pending}
              onClick={() => onRun(() => switchGoalAction(goal.id))}
            >
              {goal.title}
            </Button>
          ))}
        </div>
      ) : null}
    </Section>
  );
}

function NextAction({ today, pending, onRun }: { today: Today; pending: boolean; onRun: Runner }) {
  const [adding, setAdding] = useState(false);
  const [title, setTitle] = useState("");
  const action = today.action;

  return (
    <Section
      title="Do this next"
      aside={
        <Button variant="ghost" size="xs" onClick={() => setAdding((v) => !v)}>
          <Plus /> Add a step
        </Button>
      }
    >
      {action ? (
        <div className="rounded-lg border border-border/60 bg-background/40 p-4">
          <p className="text-base font-medium">{action.title}</p>
          {action.reason ? (
            <p className="mt-1 text-sm text-muted-foreground">{action.reason}</p>
          ) : null}
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Button nativeButton={false} size="sm" render={<Link href={action.href} />}>
              {action.cta} <ArrowRight />
            </Button>
            {action.id ? (
              <Button
                variant="outline"
                size="sm"
                disabled={pending}
                onClick={() => onRun(() => setStepStatusAction(action.id!, "done"))}
              >
                {pending ? <Loader2 className="animate-spin" /> : <Check />} Done
              </Button>
            ) : null}
            {action.dueLabel ? (
              <span className="text-xs text-muted-foreground">{action.dueLabel}</span>
            ) : null}
          </div>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">
          Nothing queued. Add the one thing you want to get done next.
        </p>
      )}

      {adding ? (
        <form
          className="mt-3 flex flex-wrap gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            const value = title;
            setTitle("");
            setAdding(false);
            onRun(() => addStepAction(value));
          }}
        >
          <input
            autoFocus
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="Tailor my CV for the Stripe role"
            className="min-w-0 flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm"
          />
          <Button type="submit" size="sm" disabled={pending || !title.trim()}>
            Add
          </Button>
        </form>
      ) : null}

      {today.alsoOpen.length > 0 ? (
        <ul className="mt-3 space-y-1.5">
          {today.alsoOpen.map((step) => (
            <li
              key={step.id}
              className="flex items-center justify-between gap-3 rounded-lg px-1 py-1.5 text-sm"
            >
              <span className="min-w-0 truncate">{step.title}</span>
              <Button
                variant="ghost"
                size="xs"
                disabled={pending}
                onClick={() => onRun(() => setStepStatusAction(step.id!, "done"))}
              >
                <Check /> Done
              </Button>
            </li>
          ))}
        </ul>
      ) : null}
    </Section>
  );
}

const RECEIPT_TONE: Record<string, string> = {
  done: "text-foreground",
  failed: "text-destructive",
  refused: "text-muted-foreground",
  running: "text-muted-foreground",
};

function WhatFadiDid({ today }: { today: Today }) {
  return (
    <Section
      title="What Fadi did"
      aside={
        today.lastPassLabel ? (
          <span className="text-xs text-muted-foreground">Last checked {today.lastPassLabel}</span>
        ) : null
      }
    >
      {today.receipts.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Nothing yet. What Fadi does on your behalf shows up here with what came of it.
        </p>
      ) : (
        <ul className="space-y-2">
          {today.receipts.map((receipt) => (
            <li key={receipt.id} className="text-sm">
              <span className={RECEIPT_TONE[receipt.status] ?? "text-foreground"}>
                {receipt.action}
              </span>
              {receipt.receipt ? (
                <span className="text-muted-foreground"> — {receipt.receipt}</span>
              ) : null}
              {receipt.status === "running" ? (
                <span className="text-muted-foreground"> — still running</span>
              ) : null}
              {receipt.error ? <span className="text-destructive"> — {receipt.error}</span> : null}
            </li>
          ))}
        </ul>
      )}
    </Section>
  );
}

function Decisions({ today }: { today: Today }) {
  if (today.decisions.length === 0) return null;
  return (
    <Section title="Needs your decision">
      <ul className="space-y-2">
        {today.decisions.map((decision) => (
          <li
            key={decision.id}
            className="flex flex-col gap-2 rounded-lg border border-border/60 bg-background/40 p-3 sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="min-w-0">
              <p className="text-sm font-medium">{decision.title}</p>
              <p className="text-xs text-muted-foreground">{decision.detail}</p>
            </div>
            <Button
              nativeButton={false}
              variant="outline"
              size="sm"
              className="shrink-0 self-start sm:self-auto"
              render={<Link href={decision.href} />}
            >
              {decision.cta}
            </Button>
          </li>
        ))}
      </ul>
    </Section>
  );
}

function Suggestions({ today }: { today: Today }) {
  if (today.suggestions.length === 0) return null;
  return (
    <Section title="Worth a look">
      <ul className="space-y-1.5">
        {today.suggestions.map((suggestion, index) => (
          <li key={`${suggestion.detail}-${index}`} className="text-sm">
            <Link href={suggestion.href} className="hover:underline underline-offset-4">
              <span className="text-muted-foreground">{suggestion.label}: </span>
              {suggestion.detail}
            </Link>
          </li>
        ))}
      </ul>
    </Section>
  );
}
