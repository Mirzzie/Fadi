"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { z } from "zod";

import { getCurrentAuthUser } from "@/lib/auth/session";
import { getDashboardProfileSummary } from "@/lib/career-report/data";
import { getToday } from "@/lib/work/today";
import { narrateNext, narratePlan, narrateReceipts, narrateToday } from "@/lib/voice/narrate";
import { MODE_COOKIE, type CareerMode } from "@/app/dashboard/mode";

/**
 * Answering by voice.
 *
 * One action for everything a spoken command needs, because the caller is a loop that must say
 * something after every utterance — silence is indistinguishable from a crash when you cannot
 * see the screen. Every path here returns `say`, even the failures.
 */

export type VoiceReply = {
  /** What Fadi says. Never empty. */
  say: string;
  /** Where to go, when the command was navigation. */
  href?: string;
  /** True when the platform changed, so the caller can refresh what is on screen. */
  changed?: boolean;
};

async function todayFor(userId: string) {
  const summary = await getDashboardProfileSummary(userId);
  const mode: CareerMode =
    (await cookies()).get(MODE_COOKIE)?.value === "prepare" ? "prepare" : "apply";
  const firstName = summary?.fullName?.trim().split(/\s+/)[0] || "there";
  return getToday(userId, firstName, mode);
}

/** Read the platform's state aloud. Changes nothing, so it never asks permission. */
export async function speakStateAction(
  what: "today" | "plan" | "next" | "did"
): Promise<VoiceReply> {
  const user = await getCurrentAuthUser();
  if (!user) return { say: "You're signed out, so I can't see your work." };

  try {
    const today = await todayFor(user.id);
    if (what === "plan") return { say: narratePlan(today) };
    if (what === "next") return { say: narrateNext(today) };
    if (what === "did") return { say: narrateReceipts(today) };
    return { say: narrateToday(today) };
  } catch {
    return { say: "I couldn't read your work just now. Try me again in a moment." };
  }
}

/**
 * Name what a spoken request WOULD do, without doing it.
 *
 * This is the whole safety story for hands-free use: the person hears exactly what is about to
 * happen, in the words of the thing it will happen to, and says yes or no. "Apply to Deerfoot"
 * heard as "apply to Deloitte" is caught here, by them, before anything is written.
 */
export async function previewVoiceApplyAction(
  target: string
): Promise<{ say: string; template?: string; refs?: { type: string; id: string }[] }> {
  const parsed = z.string().trim().min(2).max(200).safeParse(target);
  if (!parsed.success) return { say: "I didn't catch which role. Say the company or the title." };

  const user = await getCurrentAuthUser();
  if (!user) return { say: "You're signed out, so I can't start anything." };

  try {
    const { resolveIntent } = await import("@/lib/work/intent");
    const intent = await resolveIntent(user.id, `apply to ${parsed.data}`);
    if (intent.kind !== "plan") {
      return {
        say: `I can't find ${parsed.data} on your board. Say the company name, or ask me to search for it.`,
      };
    }
    return {
      say: `${intent.label}. That's six steps, and I'll stop before anything is sent. Shall I?`,
      template: intent.template,
      refs: intent.refs,
    };
  } catch {
    return { say: "I couldn't look that up just now." };
  }
}

/** Everything a voice command does that CHANGES something. Only ever after a spoken yes. */
export async function runVoiceWorkAction(
  command:
    | { kind: "advance" }
    | { kind: "stopPlan" }
    | { kind: "startProposal" }
    | { kind: "dismissProposal" }
    | { kind: "apply"; template: string; refs: { type: string; id: string }[] }
): Promise<VoiceReply> {
  const user = await getCurrentAuthUser();
  if (!user) return { say: "You're signed out, so I can't do that." };

  try {
    const today = await todayFor(user.id);

    if (command.kind === "apply") {
      const { startPlanAction } = await import("./work-actions");
      const started = await startPlanAction(command.template, command.refs);
      return started.ok
        ? {
            say: "Done — the plan's ready. Say carry on and I'll take the first step.",
            changed: true,
          }
        : { say: started.error };
    }

    if (command.kind === "startProposal" || command.kind === "dismissProposal") {
      if (!today.proposal) return { say: "There's nothing lined up to start." };
      const actions = await import("./work-actions");
      const result =
        command.kind === "startProposal"
          ? await actions.startProposedPlanAction(today.proposal.id)
          : await actions.dismissProposedPlanAction(today.proposal.id);
      if (!result.ok) return { say: result.error };
      return {
        say:
          command.kind === "startProposal"
            ? `Started ${today.proposal.title}. Say carry on for the first step.`
            : "Put it aside.",
        changed: true,
      };
    }

    if (!today.plan) {
      return { say: "There's no plan running. Tell me a role to apply to and I'll lay one out." };
    }

    if (command.kind === "stopPlan") {
      const { stopPlanAction } = await import("./work-actions");
      const stopped = await stopPlanAction(today.plan.id);
      return stopped.ok
        ? { say: "Stopped. What's done stays done.", changed: true }
        : { say: stopped.error };
    }

    const { advancePlanAction } = await import("./work-actions");
    const outcome = await advancePlanAction(today.plan.id);
    if (!outcome.ok) return { say: outcome.error };

    revalidatePath("/dashboard");
    const after = await todayFor(user.id);
    const said =
      outcome.state === "waiting"
        ? `${narrateNext(after)}`
        : outcome.state === "finished"
          ? "That's the plan finished."
          : outcome.state === "stopped"
            ? `I stopped. ${outcome.summary ?? ""}`.trim()
            : `${outcome.summary ?? "Done."} ${narrateNext(after)}`;
    return { say: said, changed: true };
  } catch {
    return { say: "That didn't go through. Nothing has changed." };
  }
}
