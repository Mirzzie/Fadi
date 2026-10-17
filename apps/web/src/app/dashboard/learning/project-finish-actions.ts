"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import {
  createLearningCommitmentsRepository,
  createProjectRunsRepository,
} from "@careeros/database";

import { getCurrentAuthUser } from "@/lib/auth/session";
import { getDatabase } from "@/lib/database/client";
import { kickOutbox } from "@/lib/outbox";
import { enqueueOutbox } from "@/lib/outbox/topics";
import {
  completionReview,
  type CompletionReview,
  type ReviewLine,
} from "@/lib/learning/project-review";
import type { StoryDraft } from "@/lib/interview/story-bank";
import {
  ANGLE_BRIEF,
  availableAngles,
  caseStudyReadme,
  walkthroughOutline,
  withReflection,
  type PostAngle,
} from "@/lib/learning/case-study";
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
  /** Null until saved. "needs-review" when the evidence gate held it as a possible duplicate. */
  recordStatus: RecordStatus | null;
  onPortfolio: boolean;
  review: CompletionReview;
};

type RecordStatus = "saved" | "needs-review";

async function recordStatusOf(userId: string, evidenceItemId: string): Promise<RecordStatus> {
  const { createEvidenceRepository } = await import("@careeros/database");
  const saved = await createEvidenceRepository(getDatabase()).getForUser(userId, evidenceItemId);
  return saved?.reviewStatus === "pending" ? "needs-review" : "saved";
}

async function isOnPortfolio(userId: string, evidenceItemId: string): Promise<boolean> {
  const { createPortfolioRepository } = await import("@careeros/database");
  const repo = createPortfolioRepository(getDatabase());
  const [site] = await repo.listSitesForUser(userId);
  if (!site) return false;
  const items = await repo.listItemsForUser(userId, site.id);
  return items.some((item) => item.evidenceItemId === evidenceItemId);
}

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
  const savedEvidenceId = project.run.evidenceItemId ?? null;
  const { createPracticeReceiptsRepository } = await import("@careeros/database");
  const receipts = await createPracticeReceiptsRepository(getDatabase()).listForRun(
    user.id,
    project.run.id
  );
  const [recordStatus, onPortfolio] = savedEvidenceId
    ? await Promise.all([
        recordStatusOf(user.id, savedEvidenceId),
        isOnPortfolio(user.id, savedEvidenceId),
      ])
    : [null, false];
  return {
    ok: true,
    view: {
      finished: project.run.status === "done",
      savedEvidenceId,
      recordStatus,
      onPortfolio,
      review: completionReview(project.run.title, project.steps, receipts),
    },
  };
}

export async function saveProjectEvidenceAction(input: {
  runId: string;
  summary: string;
  /** The decision behind the work and what went wrong — the two-minute test's hardest parts. */
  reflection?: { decision?: string; wentWrong?: string };
}): Promise<{
  ok: boolean;
  message: string;
  evidenceItemId?: string;
  recordStatus?: RecordStatus;
}> {
  const user = await getCurrentAuthUser();
  if (!user) return { ok: false, message: "Please sign in again." };
  const parsed = z
    .object({
      runId: z.string().uuid(),
      summary: z.string().trim().min(20).max(4_000),
      reflection: z
        .object({
          decision: z.string().trim().max(1_000).optional().default(""),
          wentWrong: z.string().trim().max(1_000).optional().default(""),
        })
        .optional(),
    })
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
      return {
        ok: true,
        message: "Already saved.",
        evidenceItemId: project.run.evidenceItemId,
        recordStatus: await recordStatusOf(user.id, project.run.evidenceItemId),
      };
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
      detail: withReflection(parsed.data.summary, {
        // The scenario the project was planned around: the first paragraph of its description.
        problem: project.run.detail?.split(/\n{2,}/)[0]?.trim() ?? "",
        decision: parsed.data.reflection?.decision ?? "",
        wentWrong: parsed.data.reflection?.wentWrong ?? "",
      }),
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
      // Same transaction: the work kernel and the portfolio hear about this record exactly
      // when it exists, even if the process dies before the response.
      await enqueueOutbox(
        tx,
        user.id,
        "learning.completed",
        {
          evidenceItemId: admitted.insertedId,
          runId: project.run.id,
          commitmentId: commitment?.id ?? null,
        },
        admitted.insertedId
      );
      return { id: admitted.insertedId };
    });

    if (result.status === "not_found")
      return { ok: false, message: "That project is unavailable." };
    if (result.status === "not_finished") {
      return {
        ok: false,
        message: "Finish every step first — reopened steps count as unfinished.",
      };
    }
    if (result.status === "existing") {
      return {
        ok: true,
        message: "Already saved.",
        evidenceItemId: result.evidenceItemId,
        recordStatus: await recordStatusOf(user.id, result.evidenceItemId),
      };
    }
    if (result.status !== "created") return { ok: false, message: "That project is unavailable." };

    // Downstream effects stay outside the transaction: if they fail, the evidence is still saved.
    if (commitment && commitment.status !== "completed") {
      await recordForwardMotion(user.id, "skill_closed", {
        metadata: {
          commitmentId: commitment.id,
          evidenceItemId: result.evidenceItemId,
          runId: project.run.id,
        },
      }).catch(() => null);
    }
    kickOutbox();
    revalidatePath("/dashboard/learning");
    revalidatePath("/dashboard/evidence");
    logger.info("learning.project_evidence_saved", {
      userId: user.id,
      runId: project.run.id,
      evidenceId: result.evidenceItemId,
    });
    const recordStatus = await recordStatusOf(user.id, result.evidenceItemId);
    return {
      ok: true,
      message:
        recordStatus === "needs-review"
          ? "Saved for review. It may be work you already recorded."
          : "Saved to your career record.",
      evidenceItemId: result.evidenceItemId,
      recordStatus,
    };
  } catch (error) {
    logger.error("learning.project_evidence_failed", {
      userId: user.id,
      error: error instanceof Error ? error.message : "unknown",
    });
    return { ok: false, message: "Couldn't save it. Nothing was changed — try again." };
  }
}

/**
 * What a finished piece of work was: a project run, or a course / certification commitment
 * that never had one. Both end in one career record; everything after it is shared.
 */
export type FinishSource = { runId: string } | { commitmentId: string };

const sourceSchema = z.union([
  z.object({ runId: z.string().uuid() }),
  z.object({ commitmentId: z.string().uuid() }),
]);

type SavedRecord = {
  ok: true;
  title: string;
  kind: "project" | "course";
  evidenceItemId: string;
  /** The only text a post or a story about it may draw on. */
  corpus: string;
  /** Step results backed by more than the person's word; empty for a course. */
  shown: ReviewLine[];
  /** The saved record's own text, and what the README and walkthrough are built from. */
  detail: string;
  factId: string;
  scenario: string | null;
  steps: string[];
  repoUrl: string | null;
};

/** The saved record behind a finished project or course. Refuses until the record is settled. */
async function savedRecord(
  userId: string,
  input: unknown
): Promise<SavedRecord | { ok: false; message: string }> {
  const parsed = sourceSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: "Unknown project." };
  const source = parsed.data;
  const db = getDatabase();

  let title: string;
  let kind: SavedRecord["kind"];
  let evidenceItemId: string | null;
  let shown: ReviewLine[] = [];
  let scenario: string | null = null;
  let steps: string[] = [];
  let repoUrl: string | null = null;
  if ("runId" in source) {
    const project = await createProjectRunsRepository(db).getWithSteps(userId, source.runId);
    if (!project) return { ok: false, message: "That project is unavailable." };
    title = project.run.title;
    kind = "project";
    evidenceItemId = project.run.evidenceItemId;
    // Suggestions open with the scenario as their own paragraph; that is "the problem".
    scenario = project.run.detail?.split(/\n{2,}/)[0]?.trim() || null;
    steps = [...project.steps].sort((a, b) => a.ordinal - b.ordinal).map((step) => step.title);
    repoUrl = project.run.repoUrl ?? null;
    const { createPracticeReceiptsRepository } = await import("@careeros/database");
    const receipts = await createPracticeReceiptsRepository(db).listForRun(userId, project.run.id);
    shown = completionReview(project.run.title, project.steps, receipts).lines.filter(
      (line) => line.proof !== "self-reported"
    );
  } else {
    const commitment = await createLearningCommitmentsRepository(db).getForUser(
      userId,
      source.commitmentId
    );
    if (!commitment) return { ok: false, message: "That commitment is unavailable." };
    title = commitment.title;
    kind = commitment.kind === "project" ? "project" : "course";
    evidenceItemId = commitment.evidenceItemId;
    scenario = commitment.detail?.split(/\n{2,}/)[0]?.trim() || null;
  }
  if (!evidenceItemId) {
    return { ok: false, message: "Save it to your career record first." };
  }

  const { createEvidenceRepository } = await import("@careeros/database");
  const repo = createEvidenceRepository(db);
  const saved = await repo.getForUser(userId, evidenceItemId);
  if (saved?.reviewStatus === "pending") {
    return { ok: false, message: "Decide on its possible match in Your evidence first." };
  }
  const evidence = saved ? await repo.getCanonicalForFact(userId, saved.factId ?? saved.id) : null;
  if (!evidence) return { ok: false, message: "The saved record was removed." };

  const corpus = [
    evidence.title,
    evidence.detail,
    evidence.metrics ?? "",
    ...shown.map((line) =>
      line.proof === "checked"
        ? `${line.title} (verified: ${line.result ?? "passed"})`
        : `${line.title}: ${line.result ?? ""}`
    ),
  ].join("\n");
  return {
    ok: true,
    title,
    kind,
    evidenceItemId,
    corpus,
    shown,
    detail: evidence.detail ?? "",
    factId: evidence.factId ?? evidence.id,
    scenario,
    steps,
    repoUrl,
  };
}

async function walkthroughOf(userId: string, factId: string): Promise<string | null> {
  const { createEvidenceArtifactsRepository } = await import("@careeros/database");
  const proof = await createEvidenceArtifactsRepository(getDatabase()).listForUser(userId);
  return proof.find((item) => item.factId === factId && item.kind === "video")?.url ?? null;
}

export type CaseStudyView = {
  readme: string;
  outline: Array<{ at: string; say: string }>;
  angles: PostAngle[];
  walkthroughUrl: string | null;
};

/**
 * The two-minute package, built from the record alone: a README for the repository, the beats of
 * a five-minute walkthrough, and the post angles the record can honestly support.
 */
export async function caseStudyAction(
  input: FinishSource
): Promise<{ ok: true; view: CaseStudyView } | { ok: false; message: string }> {
  const user = await getCurrentAuthUser();
  if (!user) return { ok: false, message: "Please sign in again." };
  const saved = await savedRecord(user.id, input);
  if (!saved.ok) return saved;
  const walkthroughUrl = await walkthroughOf(user.id, saved.factId);
  const study = {
    title: saved.title,
    kind: saved.kind,
    scenario: saved.scenario,
    detail: saved.detail,
    results: saved.shown.map((line) => ({
      title: line.title,
      proof: line.proof as "checked" | "result recorded",
      result: line.result,
    })),
    steps: saved.steps,
    walkthroughUrl,
    repoUrl: saved.repoUrl,
  };
  return {
    ok: true,
    view: {
      readme: caseStudyReadme(study),
      outline: walkthroughOutline(study),
      angles: availableAngles(saved.detail, saved.kind),
      walkthroughUrl,
    },
  };
}

/** Attach the recorded walkthrough to the record, so the portfolio and README can show it. */
export async function saveWalkthroughAction(
  input: FinishSource & { url: string }
): Promise<{ ok: boolean; message: string }> {
  const user = await getCurrentAuthUser();
  if (!user) return { ok: false, message: "Please sign in again." };
  let url: URL;
  try {
    url = new URL(input.url.trim());
  } catch {
    return { ok: false, message: "Paste the full link to the video, starting with https://." };
  }
  if (url.protocol !== "https:")
    return { ok: false, message: "The link needs to start with https://." };
  // The source schema keeps runId / commitmentId and drops the url.
  const saved = await savedRecord(user.id, input);
  if (!saved.ok) return saved;
  const { createEvidenceArtifactsRepository } = await import("@careeros/database");
  await createEvidenceArtifactsRepository(getDatabase()).addForFact(user.id, saved.factId, [
    { kind: "video", url: url.toString(), label: "Five-minute walkthrough" },
  ]);
  revalidatePath("/dashboard/evidence");
  revalidatePath("/dashboard/portfolio");
  return { ok: true, message: "Saved. It shows with this project on your record and portfolio." };
}

/** Where a saved record stands, for the package shown after a course is completed. */
export async function recordFinishStateAction(
  input: FinishSource
): Promise<{ ok: true; recordStatus: RecordStatus; onPortfolio: boolean } | { ok: false }> {
  const user = await getCurrentAuthUser();
  if (!user) return { ok: false };
  const parsed = sourceSchema.safeParse(input);
  if (!parsed.success || !("commitmentId" in parsed.data)) return { ok: false };
  const commitment = await createLearningCommitmentsRepository(getDatabase()).getForUser(
    user.id,
    parsed.data.commitmentId
  );
  if (!commitment?.evidenceItemId) return { ok: false };
  const [recordStatus, onPortfolio] = await Promise.all([
    recordStatusOf(user.id, commitment.evidenceItemId),
    isOnPortfolio(user.id, commitment.evidenceItemId),
  ]);
  return { ok: true, recordStatus, onPortfolio };
}

/** Draft an interview story from the saved record. Nothing is stored until the person keeps it. */
export async function draftRecordStoryAction(
  input: FinishSource
): Promise<{ ok: true; draft: StoryDraft } | { ok: false; message: string }> {
  const user = await getCurrentAuthUser();
  if (!user) return { ok: false, message: "Please sign in again." };
  const saved = await savedRecord(user.id, input);
  if (!saved.ok) return saved;
  const { draftStoryFromRecord } = await import("@/lib/interview/story-bank");
  return draftStoryFromRecord(user.id, {
    title: saved.title,
    kind: saved.kind,
    record: saved.corpus,
  });
}

/** Put this one record on the portfolio — unconfirmed, like every automatic addition. */
export async function addRecordToPortfolioAction(
  input: FinishSource
): Promise<{ ok: boolean; message: string }> {
  const user = await getCurrentAuthUser();
  if (!user) return { ok: false, message: "Please sign in again." };
  const saved = await savedRecord(user.id, input);
  if (!saved.ok) return saved;
  const { syncFromEvidence } = await import("@/app/dashboard/portfolio/actions");
  const result = await syncFromEvidence({ evidenceItemId: saved.evidenceItemId });
  if (!result.ok) return { ok: false, message: result.message };
  if (result.added > 0) {
    return { ok: true, message: "Added. It stays private until you confirm it in Portfolio." };
  }
  return result.nearMatches > 0 || (await isOnPortfolio(user.id, saved.evidenceItemId))
    ? { ok: true, message: "Already on your portfolio." }
    : { ok: false, message: "You removed this from your portfolio before, so it stays off." };
}

export type PostDraft = {
  text: string;
  /** Facts the card may show — taken from the saved evidence, never from the draft. */
  card: { title: string; lines: string[]; kind: "project" | "course" };
  /** Anything the truth gate or AI-tell check still flags after one repair. */
  warnings: string[];
};

const POST_SYSTEM = `You draft a short LinkedIn post for a person who finished a practical activity.
Use ONLY the facts in their saved evidence and step results. Structure, in plain first person:
1) what they set out to practise, without inventing where it happened;
2) one or two concrete things they actually did, naming the real tools;
3) what they observed or produced;
4) ONLY IF the evidence records a difficulty or limitation, one sentence about it. Never invent a challenge; if none is recorded, end with what they will practise next only if the evidence says so, otherwise stop.
A line marked "(verified: …)" means an assessment confirmed that result — write it as a confirmed result, without inventing who or what performed the assessment.
Rules: 60–150 words. No invented numbers, business impact, production use, employers, clients or mastery claims.
No hashtags walls (at most 3 relevant hashtags at the end). No emoji. No exclamation marks. No "thrilled", "excited to share", "journey", "delve".
Write it as work done ("I tested", "I built", "I found"), never as studying ("I'm learning", "I started learning", "my journey") — the same facts read as a practitioner, not a student.
Return the post text only in the "post" field.`;

const COURSE_POST_SYSTEM = `You draft a short LinkedIn post for a person who finished a course or certification.
Use ONLY the facts in their saved record. Structure, in plain first person:
1) what they completed, by its real name;
2) one or two concrete things the record says they learned or did;
3) ONLY IF the record says so, what they will apply it to next.
Rules: 50–120 words. Completing a course is not mastery: never claim expertise, production use, employers, clients or numbers the record does not state.
No hashtag walls (at most 3 relevant hashtags at the end). No emoji. No exclamation marks. No "thrilled", "excited to share", "journey", "delve".
Write it as work done ("I tested", "I built", "I found"), never as studying ("I'm learning", "I started learning", "my journey") — the same facts read as a practitioner, not a student.
Return the post text only in the "post" field.`;

/** Draft a post on request, from the saved record only. Never posts anything. */
export async function draftRecordPostAction(
  input: FinishSource & { angle?: PostAngle }
): Promise<{ ok: true; draft: PostDraft } | { ok: false; message: string }> {
  const user = await getCurrentAuthUser();
  if (!user) return { ok: false, message: "Please sign in again." };
  const { angle, ...source } = input;
  const saved = await savedRecord(user.id, source);
  if (!saved.ok) return saved;
  const shown = saved.shown;
  const walkthrough = await walkthroughOf(user.id, saved.factId);
  const corpus = [
    saved.scenario ? `The problem it answers: ${saved.scenario}` : "",
    saved.corpus,
    walkthrough ? `Walkthrough video: ${walkthrough}` : "",
    saved.repoUrl ? `Repository: ${saved.repoUrl}` : "",
  ]
    .filter(Boolean)
    .join("\n");
  // One project, several true posts: each angle is a different part of the same work.
  const system = `${saved.kind === "course" ? COURSE_POST_SYSTEM : POST_SYSTEM}${
    angle && availableAngles(saved.detail, saved.kind).includes(angle)
      ? `\n\nThis post's angle: ${ANGLE_BRIEF[angle]}`
      : ""
  }`;

  const { getUserDocGenerate, AiRateLimitError } = await import("@/lib/ai/user-generate");
  const generate = await getUserDocGenerate(user.id);
  if (!generate)
    return { ok: false, message: "Drafting needs an AI provider — add one in Settings → AI." };

  const { truthCheck } = await import("@/lib/documents/truth-gate");
  const { findAiTells } = await import("@/lib/documents/humanize");
  const problems = (text: string) => [
    ...truthCheck(text, { corpus }).map((finding) => finding.message),
    ...findAiTells(text).map((tell) => `Sounds machine-written: "${tell}"`),
  ];
  const schema = z.object({ post: z.string().min(40).max(1_600) });

  try {
    const first = await generate.structured(
      system,
      `Saved evidence and results:\n${corpus}`,
      schema,
      "project_post"
    );
    let text = first.post.trim();
    let warnings = problems(text);
    if (warnings.length > 0) {
      // One repair, told exactly what was wrong. Whatever remains is shown, not hidden.
      const retry = await generate.structured(
        system,
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
          title: saved.title,
          lines: shown.slice(0, 3).map((line) => line.title),
          kind: saved.kind,
        },
      },
    };
  } catch (error) {
    if (error instanceof AiRateLimitError) return { ok: false, message: error.message };
    const detail = error instanceof Error ? error.message : String(error);
    if (/\b429\b|rate.?limit/i.test(detail)) {
      return {
        ok: false,
        message: "Your AI provider is rate-limiting. Wait a minute and try again.",
      };
    }
    return {
      ok: false,
      message: "Couldn't draft a post just now. Your evidence is saved — try again later.",
    };
  }
}
