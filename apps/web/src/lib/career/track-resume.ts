import "server-only";

import {
  createLinkedInProfilesRepository,
  createProfilesRepository,
  createResumesRepository,
  type CareerProfile,
} from "@careeros/database";

import { getDatabase } from "@/lib/database/client";
import { getUserDocGenerate } from "@/lib/ai/user-generate";
import { composeCareerEvidence } from "@/lib/career/evidence";
import { pivotFraming } from "@/lib/career/pivot";
import { resumeToPlainText } from "@/lib/documents/resume";
import { resumeGenerationSchema, toResumeData } from "@/lib/documents/resume-schema";
import { HUMANIZE_CORE, HUMANIZE_RESUME } from "@/lib/documents/humanize";
import { logger } from "@/lib/observability/logger";

/**
 * Draft a new direction's BASE resume from the shared source of truth — the
 * architecture the user asked for: constant data (career history, education)
 * lives once; each direction gets its own customized resume, auto-created on
 * direction creation and editable afterwards (Profile → resume, per direction).
 *
 * Best-effort by design: no provider or no history → skip quietly (the direction
 * falls back to the shared resume until one exists). Never fabricates — the
 * pivot framing adopts adjacent-field experience and names transferable skills
 * only where the evidence shows them.
 */
export async function draftTrackBaseResume(userId: string, track: CareerProfile): Promise<boolean> {
  try {
    const generate = await getUserDocGenerate(userId);
    if (!generate) {
      logger.info("tracks.base_resume.skipped", { userId, trackId: track.id, reason: "no_provider" });
      return false;
    }

    const db = getDatabase();
    const [profile, sharedResume, linkedin] = await Promise.all([
      createProfilesRepository(db).getByUserId(userId),
      // The new track has no resume yet — this resolves the shared/legacy base.
      createResumesRepository(db).getLatestForTrack(userId, track.id),
      createLinkedInProfilesRepository(db).getLatestForUser(userId),
    ]);

    const evidence = composeCareerEvidence({
      resumeText: sharedResume?.parsedText ?? sharedResume?.rawText,
      linkedInText: linkedin?.rawText ?? linkedin?.profileUrl,
    });
    if (evidence.historySource === "none") {
      logger.info("tracks.base_resume.skipped", { userId, trackId: track.id, reason: "no_history" });
      return false;
    }

    const system = `You are Fadi, an expert resume writer. From the candidate's REAL career history below, produce the BASE resume for their "${track.targetRole}" direction${track.domain ? ` (${track.domain})` : ""} — the tailored starting point every application in this direction builds on.
- Keep their real roles, companies, dates, education and projects exactly.
- Rewrite the summary and bullets to position them for this direction, using its vocabulary where genuinely accurate.
CRITICAL: use ONLY real experience, education, skills and projects from the provided material. Never invent employers, dates, degrees, or achievements. If a section is thin, keep it short rather than fabricating.

${pivotFraming({ targetRole: track.targetRole, domain: track.domain, intent: track.intent, careerGoal: track.careerGoal })}

${HUMANIZE_CORE}

${HUMANIZE_RESUME}`;

    const gen = await generate.structured(system, evidence.block, resumeGenerationSchema, "track_base_resume");
    const text = resumeToPlainText(
      toResumeData(gen, {
        name: profile?.fullName ?? "",
        headline: track.targetRole ?? "",
        email: profile?.email ?? "",
        phone: "",
        location: track.location ?? "",
        links: linkedin?.profileUrl ?? "",
      }),
    ).trim();
    if (!text) {
      logger.warn("tracks.base_resume.empty", { userId, trackId: track.id });
      return false;
    }

    await createResumesRepository(db).upsertLatestForTrack(userId, track.id, text);
    logger.info("tracks.base_resume.created", { userId, trackId: track.id, chars: text.length });
    return true;
  } catch (error) {
    logger.warn("tracks.base_resume.failed", {
      userId,
      trackId: track.id,
      error: error instanceof Error ? error.message : "unknown",
    });
    return false;
  }
}
