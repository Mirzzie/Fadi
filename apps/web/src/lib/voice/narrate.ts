import "server-only";

import type { Today } from "@/lib/work/today";

/**
 * Fadi, out loud.
 *
 * Written to be HEARD, which is a different job from being read. Someone listening cannot skim
 * back, cannot see which part is a heading, and loses the start of a sentence if the end of it
 * matters more. So: short sentences, the answer first, numbers spoken as words where a digit
 * would be read oddly, and never a list longer than three.
 *
 * And never a claim the screen would not make. This narrates the same `Today` the page renders,
 * so what is said and what is shown cannot drift apart.
 */

function sentence(text: string): string {
  const trimmed = text.trim();
  if (!trimmed) return "";
  return /[.!?]$/.test(trimmed) ? trimmed : `${trimmed}.`;
}

function list(items: string[]): string {
  if (items.length === 0) return "";
  if (items.length === 1) return items[0]!;
  return `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
}

/** The whole picture, in the order the screen has it. Kept under about twenty seconds. */
export function narrateToday(today: Today): string {
  const parts: string[] = [];

  parts.push(
    today.goal.source === "none"
      ? "You haven't set what you're working towards yet."
      : `You're working towards ${today.goal.title}.`
  );

  if (today.plan) {
    const done = today.plan.steps.filter((step) => step.status === "done").length;
    const next = today.plan.steps.find((step) => step.status !== "done");
    parts.push(`I'm working on ${today.plan.title}.`);
    parts.push(`${done} of ${today.plan.steps.length} steps done.`);
    if (next) {
      parts.push(
        next.automatic
          ? `Next is ${next.title}. Say carry on and I'll do it.`
          : `Next is ${next.title}, and that one's yours.`
      );
    }
  } else if (today.proposal) {
    parts.push(
      `I've lined up ${today.proposal.title}, ${today.proposal.steps} steps, not started.`
    );
    parts.push("Say start it, or not now.");
  } else if (today.action) {
    parts.push(`Your next step is ${today.action.title}.`);
  }

  if (today.decisions.length > 0) {
    parts.push(
      `${today.decisions.length} thing${today.decisions.length === 1 ? "" : "s"} need${today.decisions.length === 1 ? "s" : ""} your decision: ${list(today.decisions.slice(0, 3).map((decision) => decision.title))}.`
    );
  }

  return parts.map(sentence).join(" ");
}

/** Just the plan, step by step, for someone following along without the screen. */
export function narratePlan(today: Today): string {
  if (!today.plan) {
    return today.proposal
      ? `Nothing running. I've lined up ${today.proposal.title}. Say start it, or not now.`
      : "There's no plan running. Tell me a role to apply to and I'll lay one out.";
  }

  const lines = today.plan.steps.map((step) => {
    if (step.status === "done") {
      return step.outcome ? `Done: ${step.title}. ${step.outcome}` : `Done: ${step.title}.`;
    }
    if (step.status === "blocked") return `Stopped at ${step.title}. ${step.note}`;
    return step.automatic ? `To do: ${step.title}.` : `Yours to do: ${step.title}.`;
  });

  return `${today.plan.title}. ${lines.join(" ")}`;
}

/** The single next thing, and whose it is. The most-asked question in an eyes-free session. */
export function narrateNext(today: Today): string {
  if (today.plan) {
    const next = today.plan.steps.find((step) => step.status !== "done");
    if (!next) return "That plan is finished.";
    if (next.status === "blocked") return `It stopped at ${next.title}. ${next.note}`;
    return next.automatic
      ? `Next is ${next.title}. Say carry on and I'll do it.`
      : `Next is ${next.title}. That one's yours — I can't do it for you.`;
  }
  if (today.proposal) {
    return `I've lined up ${today.proposal.title}. Say start it, or not now.`;
  }
  if (today.action) {
    return today.action.reason
      ? `${today.action.title}. ${today.action.reason}`
      : today.action.title;
  }
  return "Nothing queued. Tell me a role to apply to, or add a step.";
}

/** What Fadi has actually done, from the receipts — never from a claim. */
export function narrateReceipts(today: Today): string {
  if (today.receipts.length === 0) {
    return "I haven't done anything on your behalf yet.";
  }
  const recent = today.receipts.slice(0, 3).map((receipt) => {
    const how =
      receipt.status === "done"
        ? ""
        : receipt.status === "needs_input"
          ? ", which is waiting on you"
          : receipt.status === "failed"
            ? ", which failed"
            : ", which didn't run";
    return `${receipt.action}${how}, ${receipt.atLabel}`;
  });
  return `${list(recent)}.`;
}
