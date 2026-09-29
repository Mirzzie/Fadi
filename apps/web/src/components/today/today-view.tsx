"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { ArrowRight, Check, CircleDot, Loader2, Plus, Sparkles, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useFadi } from "@/components/os/fadi-presence";
import {
  addStepAction,
  advancePlanAction,
  dismissProposedPlanAction,
  startProposedPlanAction,
  setGoalAction,
  setStepStatusAction,
  stopPlanAction,
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
      <RunningPlan today={today} pending={pending} onRun={run} />
      <Proposal today={today} pending={pending} onRun={run} />
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
  const { openOnWork } = useFadi();
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
              <>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={pending}
                  onClick={() => onRun(() => setStepStatusAction(action.id!, "done"))}
                >
                  {pending ? <Loader2 className="animate-spin" /> : <Check />} Done
                </Button>
                {/* Opens Fadi on THIS step: its own thread, so the answer is about this work
                    and not the last thing that was discussed. */}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => openOnWork({ workItemId: action.id!, title: action.title })}
                >
                  <Sparkles /> Ask Fadi
                </Button>
              </>
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
              <span className="flex shrink-0 items-center gap-1">
                <Button
                  variant="ghost"
                  size="xs"
                  onClick={() => openOnWork({ workItemId: step.id!, title: step.title })}
                >
                  <Sparkles /> Ask Fadi
                </Button>
                <Button
                  variant="ghost"
                  size="xs"
                  disabled={pending}
                  onClick={() => onRun(() => setStepStatusAction(step.id!, "done"))}
                >
                  <Check /> Done
                </Button>
              </span>
            </li>
          ))}
        </ul>
      ) : null}
    </Section>
  );
}

/**
 * The plan, as it runs.
 *
 * This is the surface that replaces a chat window. What Fadi is doing is a list of steps that
 * tick over in place — not prose claiming work happened, and not a spinner with no content. A
 * step that stopped says what stopped it, in the capability's own words.
 */
function RunningPlan({ today, pending, onRun }: { today: Today; pending: boolean; onRun: Runner }) {
  const plan = today.plan;
  if (!plan) return null;

  return (
    <Section
      title="Fadi is working"
      aside={
        <Button
          variant="ghost"
          size="xs"
          disabled={pending}
          onClick={() => onRun(() => stopPlanAction(plan.id))}
        >
          <X /> Stop
        </Button>
      }
    >
      <p className="text-base font-medium">{plan.title}</p>

      <ol className="mt-3 space-y-2">
        {plan.steps.map((step) => (
          <li key={step.id} className="flex gap-2.5 text-sm">
            <StepMark status={step.status} />
            <span className="min-w-0">
              <span className={step.status === "done" ? "text-muted-foreground" : ""}>
                {step.title}
              </span>
              {!step.automatic && step.status !== "done" ? (
                <span className="ml-2 text-xs text-muted-foreground">yours to do</span>
              ) : null}
              {step.outcome ? (
                <span className="line-clamp-2 text-xs text-muted-foreground">{step.outcome}</span>
              ) : null}
              {step.output ? (
                <Link
                  href={step.output.href}
                  className="text-xs text-primary underline underline-offset-4"
                >
                  {step.output.label}
                </Link>
              ) : null}
              {step.note ? (
                <span className="block text-xs text-destructive">{step.note}</span>
              ) : null}
            </span>
          </li>
        ))}
      </ol>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        {plan.fadiCanContinue ? (
          <Button
            size="sm"
            disabled={pending}
            onClick={() => onRun(() => advancePlanAction(plan.id))}
          >
            {pending ? <Loader2 className="animate-spin" /> : <ArrowRight />} Do the next step
          </Button>
        ) : (
          <span className="text-xs text-muted-foreground">
            The next step is yours. Fadi will pick it up again after.
          </span>
        )}
      </div>
    </Section>
  );
}

/**
 * Work Fadi lined up while nobody was looking — and did not start.
 *
 * The whole point is the two buttons. Background work that acts on its own spends the person's
 * money and writes in their name; background work that only leaves notes is a newsletter. This
 * is the middle: the paperwork is ready, and starting it is still a decision.
 */
function Proposal({ today, pending, onRun }: { today: Today; pending: boolean; onRun: Runner }) {
  const proposal = today.proposal;
  if (!proposal) return null;

  return (
    <Section title="Fadi lined this up">
      <p className="text-base font-medium">{proposal.title}</p>
      <p className="mt-1 text-sm text-muted-foreground">
        {proposal.steps} steps, ready to go. Nothing has run and nothing has been written.
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button
          size="sm"
          disabled={pending}
          onClick={() => onRun(() => startProposedPlanAction(proposal.id))}
        >
          {pending ? <Loader2 className="animate-spin" /> : <ArrowRight />} Start it
        </Button>
        <Button
          variant="ghost"
          size="sm"
          disabled={pending}
          onClick={() => onRun(() => dismissProposedPlanAction(proposal.id))}
        >
          Not now
        </Button>
      </div>
    </Section>
  );
}

function StepMark({ status }: { status: string }) {
  if (status === "done") return <Check className="mt-0.5 size-4 shrink-0 text-primary" />;
  if (status === "active")
    return <Loader2 className="mt-0.5 size-4 shrink-0 animate-spin text-primary" />;
  if (status === "blocked")
    return <CircleDot className="mt-0.5 size-4 shrink-0 text-destructive" />;
  return <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-muted-foreground/40" />;
}

const RECEIPT_TONE: Record<string, string> = {
  done: "text-foreground",
  failed: "text-destructive",
  refused: "text-muted-foreground",
  needs_input: "text-foreground",
  running: "text-muted-foreground",
  retrying: "text-muted-foreground",
};

/** What the status means, said plainly. An empty string means the receipt speaks for itself. */
const RECEIPT_NOTE: Record<string, string> = {
  running: "still running",
  needs_input: "waiting on you",
  refused: "did not run",
  retrying: "didn't go through yet; Fadi will try again",
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
              {RECEIPT_NOTE[receipt.status] ? (
                <span className="text-muted-foreground"> — {RECEIPT_NOTE[receipt.status]}</span>
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
