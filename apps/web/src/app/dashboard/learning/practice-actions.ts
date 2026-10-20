"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { MAX_SUBMISSION_CHARS } from "@careeros/database";

import { getCurrentAuthUser } from "@/lib/auth/session";
import type { DocumentStepState, SubmitResult } from "@/lib/practice/document-sim";
import type { CheckResult, GraderStatus } from "@/lib/practice/grader-check";

/**
 * Work simulations (Practice packs): start one, hand in a step, read a step's state. Each checks
 * the session and passes the caller's own id to the server-only service — never a user id from
 * the browser.
 */

export async function startPracticeActivityAction(input: {
  packId: string;
  activityId: string;
}): Promise<{ ok: true; runId: string } | { ok: false; message: string }> {
  const user = await getCurrentAuthUser();
  if (!user) return { ok: false, message: "Please sign in again." };
  const parsed = z
    .object({ packId: z.string().min(1).max(160), activityId: z.string().min(1).max(160) })
    .safeParse(input);
  if (!parsed.success) return { ok: false, message: "Unknown activity." };
  const { startPracticeActivity } = await import("@/lib/practice/document-sim");
  const result = await startPracticeActivity(user.id, parsed.data);
  if (result.ok) revalidatePath("/dashboard/learning");
  return result;
}

export async function submitPracticeWorkAction(input: {
  runId: string;
  stepId: string;
  body: string;
  /** Picks for steps that ask for a decision; checked against the case's options on the server. */
  choices?: Record<string, string>;
}): Promise<SubmitResult> {
  const user = await getCurrentAuthUser();
  if (!user) return { ok: false, message: "Please sign in again." };
  const parsed = z
    .object({
      runId: z.string().uuid(),
      stepId: z.string().uuid(),
      body: z
        .string()
        .trim()
        .min(40)
        .max(MAX_SUBMISSION_CHARS - 600),
      choices: z.record(z.string().max(80), z.string().max(160)).optional(),
    })
    .safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: "Write at least a few sentences before submitting." };
  }
  const { submitForReview } = await import("@/lib/practice/document-sim");
  const result = await submitForReview(user.id, parsed.data);
  if (result.ok && result.review.verdict === "pass") revalidatePath("/dashboard/learning");
  return result;
}

export async function documentStepStateAction(input: {
  runId: string;
  stepId: string;
}): Promise<DocumentStepState | null> {
  const user = await getCurrentAuthUser();
  if (!user) return null;
  const parsed = z.object({ runId: z.string().uuid(), stepId: z.string().uuid() }).safeParse(input);
  if (!parsed.success) return null;
  const { documentStepState } = await import("@/lib/practice/document-sim");
  return documentStepState(user.id, parsed.data);
}

export async function revealHintAction(input: {
  runId: string;
  stepId: string;
}): Promise<{ ok: true; hints: string[] } | { ok: false; message: string }> {
  const user = await getCurrentAuthUser();
  if (!user) return { ok: false, message: "Please sign in again." };
  const parsed = z.object({ runId: z.string().uuid(), stepId: z.string().uuid() }).safeParse(input);
  if (!parsed.success) return { ok: false, message: "Unknown step." };
  const { revealHint } = await import("@/lib/practice/document-sim");
  return revealHint(user.id, parsed.data);
}

/** A new case for the same activity; the attempt in progress stays on its record. */
export async function restartPracticeActivityAction(input: {
  runId: string;
}): Promise<{ ok: true; runId: string } | { ok: false; message: string }> {
  const user = await getCurrentAuthUser();
  if (!user) return { ok: false, message: "Please sign in again." };
  if (!z.string().uuid().safeParse(input.runId).success) {
    return { ok: false, message: "Unknown simulation." };
  }
  const { restartPracticeActivity } = await import("@/lib/practice/document-sim");
  const result = await restartPracticeActivity(user.id, input);
  if (result.ok) revalidatePath("/dashboard/learning");
  return result;
}

/** Run the marking check on the person's current model. They asked: it spends their allowance. */
const activityRef = z.object({
  packId: z.string().min(1).max(160),
  activityId: z.string().min(1).max(160),
});

/** Which activity's marking check: a pass for one activity says nothing about another. */
async function installed(input: unknown) {
  const parsed = activityRef.safeParse(input);
  if (!parsed.success) return null;
  const { activityRuntime } = await import("@/lib/practice/packs");
  return activityRuntime(parsed.data.packId, parsed.data.activityId) ? parsed.data : null;
}

export async function checkGraderAction(input: {
  packId: string;
  activityId: string;
}): Promise<CheckResult> {
  const user = await getCurrentAuthUser();
  if (!user) return { ok: false, message: "Please sign in again." };
  const ref = await installed(input);
  if (!ref) return { ok: false, message: "Unknown activity." };
  const { checkGrader } = await import("@/lib/practice/grader-check");
  const result = await checkGrader(user.id, ref);
  revalidatePath("/dashboard/learning");
  return result;
}

export async function graderStatusAction(input: {
  packId: string;
  activityId: string;
}): Promise<GraderStatus | null> {
  const user = await getCurrentAuthUser();
  if (!user) return null;
  const ref = await installed(input);
  if (!ref) return null;
  const { graderStatus } = await import("@/lib/practice/grader-check");
  return graderStatus(user.id, ref);
}
