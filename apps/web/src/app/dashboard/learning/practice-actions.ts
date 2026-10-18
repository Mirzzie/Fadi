"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { MAX_SUBMISSION_CHARS } from "@careeros/database";

import { getCurrentAuthUser } from "@/lib/auth/session";
import type { DocumentStepState, SubmitResult } from "@/lib/practice/document-sim";

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
}): Promise<SubmitResult> {
  const user = await getCurrentAuthUser();
  if (!user) return { ok: false, message: "Please sign in again." };
  const parsed = z
    .object({
      runId: z.string().uuid(),
      stepId: z.string().uuid(),
      body: z.string().trim().min(40).max(MAX_SUBMISSION_CHARS),
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
