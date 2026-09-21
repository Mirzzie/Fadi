"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import {
  createLearningCommitmentsRepository,
  createProjectRunsRepository,
} from "@careeros/database";

import { getCurrentAuthUser } from "@/lib/auth/session";
import { getDatabase } from "@/lib/database/client";
import { publish } from "@/lib/events/bus";
import { completionReview, type CompletionReview } from "@/lib/learning/project-review";
import { logger } from "@/lib/observability/logger";
import { recordForwardMotion } from "@/lib/resilience/service";

/**
 * THE FINISH LINE: a finished project becomes evidence, once, after the person has read it.
 *
 * Every step of a project could be done and nothing happened — the run never finished and no
 * evidence existed, so the résumé, portfolio and interview stories had nothing to draw on. The
 * run now finishes in the repository when its last step does; this is the review and the save.
 */

export type FinishView = {
  finished: boolean;
  savedEvidenceId: string | null;
  review: CompletionReview;
};

export async function projectFinishAction(input: {
  runId: string;
}): Promise<{ ok: true; view: FinishView } | { ok: false; message: string }> {
  const user = await getCurrentAuthUser();
  if (!user) return { ok: false, message: "Please sign in again." };
  const id = z.string().uuid().safeParse(input.runId);
  if (!id.success) return { ok: false, message: "Unknown project." };

  const runs = createProjectRunsRepository(getDatabase());
  await runs.settle(user.id, id.data);
  const project = await runs.getWithSteps(user.id, id.data);
  if (!project) return { ok: false, message: "That project is unavailable." };
  return {
    ok: true,
    view: {
      finished: project.run.status === "done",
      savedEvidenceId: project.run.evidenceItemId ?? null,
      review: completionReview(project.run.title, project.steps),
    },
  };
}

export async function saveProjectEvidenceAction(input: {
  runId: string;
  summary: string;
}): Promise<{ ok: boolean; message: string; evidenceItemId?: string }> {
  const user = await getCurrentAuthUser();
  if (!user) return { ok: false, message: "Please sign in again." };
  const parsed = z
    .object({ runId: z.string().uuid(), summary: z.string().trim().min(20).max(4_000) })
    .safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: "Say what you did in a sentence or two before saving it." };
  }

  try {
    const db = getDatabase();
    const runs = createProjectRunsRepository(db);
    const project = await runs.getWithSteps(user.id, parsed.data.runId);
    if (!project) return { ok: false, message: "That project is unavailable." };
    if (project.run.evidenceItemId) {
      return { ok: true, message: "Already saved.", evidenceItemId: project.run.evidenceItemId };
    }

    const commitment = project.run.commitmentId
      ? await createLearningCommitmentsRepository(db).getForUser(user.id, project.run.commitmentId)
      : null;

    // Through the evidence gate like every other career record — a project someone already
    // recorded by hand while doing it is the duplicate it catches — but inside the run's lock,
    // so the evidence and the project's link to it land together or not at all.
    const { admitEvidence } = await import("@/lib/identity/admit");
    const candidate = {
      kind: "project",
      title: project.run.title,
      organization: null,
      period: new Date().getFullYear().toString(),
      detail: parsed.data.summary,
      metrics: null,
      tags: commitment?.gap ? [commitment.gap.toLowerCase().trim()] : [],
      origin: "learning",
    };

    const result = await runs.saveEvidenceOnce(user.id, project.run.id, async (tx) => {
      const admitted = await admitEvidence(user.id, candidate, { db: tx });
      if (commitment && commitment.status !== "completed") {
        await createLearningCommitmentsRepository(tx).completeForUser(
          user.id,
          commitment.id,
          admitted.insertedId
        );
      }
      return { id: admitted.insertedId };
    });

    if (result.status === "not_found") return { ok: false, message: "That project is unavailable." };
    if (result.status === "not_finished") {
      return { ok: false, message: "Finish every step first — reopened steps count as unfinished." };
    }
    if (result.status === "existing") {
      return { ok: true, message: "Already saved.", evidenceItemId: result.evidenceItemId };
    }
    if (result.status !== "created") return { ok: false, message: "That project is unavailable." };

    // Downstream effects stay outside the transaction: if they fail, the evidence is still saved.
    if (commitment && commitment.status !== "completed") {
      await recordForwardMotion(user.id, "skill_closed", {
        metadata: { commitmentId: commitment.id, evidenceItemId: result.evidenceItemId, runId: project.run.id },
      }).catch(() => null);
    }
    await publish("evidence.changed", {
      userId: user.id,
      reason: "learning_completed",
      evidenceItemId: result.evidenceItemId,
    });
    revalidatePath("/dashboard/learning");
    revalidatePath("/dashboard/evidence");
    logger.info("learning.project_evidence_saved", {
      userId: user.id,
      runId: project.run.id,
      evidenceId: result.evidenceItemId,
    });
    const { createEvidenceRepository } = await import("@careeros/database");
    const saved = await createEvidenceRepository(db).getForUser(user.id, result.evidenceItemId);
    return { ok: true, message: saved?.reviewStatus === "pending"
      ? "Saved for review. Open Your evidence to decide whether this is work already recorded."
      : "Saved to your evidence.", evidenceItemId: result.evidenceItemId };
  } catch (error) {
    logger.error("learning.project_evidence_failed", {
      userId: user.id,
      error: error instanceof Error ? error.message : "unknown",
    });
    return { ok: false, message: "Couldn't save it. Nothing was changed — try again." };
  }
}

export type PostDraft = {
  text: string;
  /** Facts the card may show — taken from the saved evidence, never from the draft. */
  card: { title: string; lines: string[] };
  /** Anything the truth gate or AI-tell check still flags after one repair. */
  warnings: string[];
};

const POST_SYSTEM = `You draft a short LinkedIn post for a person who finished a hands-on practice project.
Use ONLY the facts in their saved evidence and step results. Structure, in plain first person:
1) what they set out to practise (one sentence, say "in my home lab" or "in a local lab");
2) one or two concrete things they actually did, naming the real tools;
3) what they observed or produced;
4) ONLY IF the evidence records a difficulty or limitation, one sentence about it. Never invent a challenge; if none is recorded, end with what they will practise next only if the evidence says so, otherwise stop.
A line marked "(checked in the lab: …)" means Fadi confirmed that result — write it as a confirmed result ("confirmed the configuration is valid"), never as a command the person ran.
Rules: 60–150 words. No invented numbers, business impact, production use, employers, clients or mastery claims.
No hashtags walls (at most 3 relevant hashtags at the end). No emoji. No exclamation marks. No "thrilled", "excited to share", "journey", "delve".
Return the post text only in the "post" field.`;

/** Draft a post on request, from the saved evidence only. Never posts anything. */
export async function draftProjectPostAction(input: {
  runId: string;
}): Promise<{ ok: true; draft: PostDraft } | { ok: false; message: string }> {
  const user = await getCurrentAuthUser();
  if (!user) return { ok: false, message: "Please sign in again." };
  const id = z.string().uuid().safeParse(input.runId);
  if (!id.success) return { ok: false, message: "Unknown project." };

  const db = getDatabase();
  const project = await createProjectRunsRepository(db).getWithSteps(user.id, id.data);
  if (!project?.run.evidenceItemId) {
    return { ok: false, message: "Save the project as evidence first — the post is drafted from it." };
  }
  const { createEvidenceRepository } = await import("@careeros/database");
  const repo = createEvidenceRepository(db);
  const saved = await repo.getForUser(user.id, project.run.evidenceItemId);
  if (saved?.reviewStatus === "pending") return { ok: false, message: "Review this project's possible match in Your evidence before drafting a post." };
  const evidence = saved ? await repo.getCanonicalForFact(user.id, saved.factId ?? saved.id) : null;
  if (!evidence) return { ok: false, message: "The saved evidence for this project was removed." };

  const review = completionReview(project.run.title, project.steps);
  const shown = review.lines.filter((line) => line.proof !== "self-reported");
  const corpus = [
    evidence.title,
    evidence.detail,
    evidence.metrics ?? "",
    ...shown.map((line) =>
      line.proof === "checked"
        ? `${line.title} (checked in the lab: ${line.result ?? "passed"})`
        : `${line.title}: ${line.result ?? ""}`
    ),
  ].join("\n");

  const { getUserDocGenerate, AiRateLimitError } = await import("@/lib/ai/user-generate");
  const generate = await getUserDocGenerate(user.id);
  if (!generate) return { ok: false, message: "Drafting needs an AI provider — add one in Settings → AI." };

  const { truthCheck } = await import("@/lib/documents/truth-gate");
  const { findAiTells } = await import("@/lib/documents/humanize");
  const problems = (text: string) => [
    ...truthCheck(text, { corpus }).map((finding) => finding.message),
    ...findAiTells(text).map((tell) => `Sounds machine-written: "${tell}"`),
  ];
  const schema = z.object({ post: z.string().min(40).max(1_600) });

  try {
    const first = await generate.structured(POST_SYSTEM, `Saved evidence and results:\n${corpus}`, schema, "project_post");
    let text = first.post.trim();
    let warnings = problems(text);
    if (warnings.length > 0) {
      // One repair, told exactly what was wrong. Whatever remains is shown, not hidden.
      const retry = await generate.structured(
        POST_SYSTEM,
        `Saved evidence and results:\n${corpus}\n\nYour previous draft had these problems; fix every one:\n- ${warnings.join("\n- ")}\n\nPrevious draft:\n${text}`,
        schema,
        "project_post"
      );
      const retryWarnings = problems(retry.post);
      if (retryWarnings.length <= warnings.length) {
        text = retry.post.trim();
        warnings = retryWarnings;
      }
    }
    return {
      ok: true,
      draft: {
        text,
        warnings,
        card: {
          title: project.run.title,
          lines: shown.slice(0, 3).map((line) => line.title),
        },
      },
    };
  } catch (error) {
    if (error instanceof AiRateLimitError) return { ok: false, message: error.message };
    const detail = error instanceof Error ? error.message : String(error);
    if (/\b429\b|rate.?limit/i.test(detail)) {
      return { ok: false, message: "Your AI provider is rate-limiting. Wait a minute and try again." };
    }
    return { ok: false, message: "Couldn't draft a post just now. Your evidence is saved — try again later." };
  }
}
