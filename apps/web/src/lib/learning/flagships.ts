import "server-only";

import { z } from "zod";

import {
  createApplicationsRepository,
  createCareerProfilesRepository,
  createEvidenceRepository,
} from "@careeros/database";

import { getUserDocGenerate } from "@/lib/ai/user-generate";
import { getLatestCareerReport } from "@/lib/career-report/data";
import { getDatabase } from "@/lib/database/client";
import { logger } from "@/lib/observability/logger";
import { searchRecent } from "@/lib/research/recent";

import {
  acceptFlagships,
  flagshipsAreStale,
  researchQueries,
  type Flagship,
} from "./flagship-rules";

export type FlagshipsState = {
  flagships: Flagship[];
  refreshedAt: string | null;
  stale: boolean;
  direction: string | null;
};

const schema = z.object({
  projects: z
    .array(
      z.object({
        title: z.string(),
        problem: z.string(),
        whyNow: z.string(),
        build: z.string(),
        breakIt: z.string(),
        demonstrates: z.string(),
        scope: z.string(),
        buildsOn: z.string(),
        sourceUrls: z.array(z.string()),
      })
    )
    .max(4),
});

/** What is stored for the active direction, and whether it is due for fresh research. */
export async function getFlagships(userId: string): Promise<FlagshipsState> {
  const track = await createCareerProfilesRepository(getDatabase()).getActiveForUser(userId);
  const flagships = (track?.flagshipProjects ?? []) as unknown as Flagship[];
  return {
    flagships,
    refreshedAt: track?.flagshipsRefreshedAt?.toISOString() ?? null,
    stale: flagshipsAreStale(track?.flagshipsRefreshedAt),
    direction: track?.targetRole ?? null,
  };
}

/**
 * Research this month's problems for the active direction and propose two or three flagship
 * projects grounded in them and in the person's own record.
 */
export async function refreshFlagships(
  userId: string
): Promise<{ ok: true; state: FlagshipsState } | { ok: false; message: string }> {
  const db = getDatabase();
  const profiles = createCareerProfilesRepository(db);
  const track = await profiles.getActiveForUser(userId);
  if (!track) return { ok: false, message: "Choose a career direction first." };

  const generate = await getUserDocGenerate(userId);
  if (!generate) {
    return {
      ok: false,
      message: "Finding flagship projects needs an AI provider — add one in Settings → AI.",
    };
  }

  const [report, evidence, applications] = await Promise.all([
    getLatestCareerReport(userId),
    createEvidenceRepository(db).listForUser(userId),
    createApplicationsRepository(db).listForUser(userId, {
      scope: "active",
      careerProfileId: track.id,
    }),
  ]);
  const gaps = (report?.missing_skills ?? []).map((gap) => gap.title);
  const research = await searchRecent(
    researchQueries({
      role: track.targetRole,
      domain: track.domain,
      gaps,
      year: new Date().getFullYear(),
    })
  );

  const record = evidence
    .filter((item) => item.reviewStatus !== "pending")
    .slice(0, 25)
    .map(
      (item) =>
        `- [${item.kind}] ${item.title}${item.organization ? ` (${item.organization})` : ""}: ${item.detail.slice(0, 160)}`
    )
    .join("\n");
  const postings = applications
    .map((application) => application.jobDescription?.trim())
    .filter((text): text is string => Boolean(text))
    .slice(0, 3)
    .map((text) => text.slice(0, 600));

  const system = `You propose the TWO or THREE flagship portfolio projects a person targeting "${track.targetRole}"${track.domain ? ` in ${track.domain}` : ""} should build next.

A flagship is substantial (weeks, not an evening) and answers a business problem organisations are facing NOW. It is the kind of work that makes a hiring manager think "this person could take one of our problems off our hands" — never a tutorial, never "set up X".

Rules:
- Ground every problem in the RESEARCH provided: cite it by putting the exact URLs you relied on in sourceUrls. Never cite a URL that is not in the research. Never invent statistics, companies or incidents; describe the problem in general terms ("a retailer", "a hospital trust").
- title: a short name for the work (under 60 characters), no numbering, no "Flagship".
- problem: the scenario in one or two sentences — the KIND of organisation ("a regional hospital", "a SaaS startup"), never a real company named as the one with the problem, and what the problem costs them in plain words. No numbers unless the research states them.
- whyNow: one sentence on why it matters this year, from the research.
- build: what they build, concretely, naming the real free or open-source tools (e.g. Wazuh, Terraform, Entra ID free tier, OWASP ZAP) — never "an AI-driven solution" or "a proof-of-concept platform".
- breakIt: how they attack, stress or fail it on purpose, and what fixing that shows.
- demonstrates: what finishing it proves for ${track.targetRole}.
- scope: a realistic duration for one person in evenings.
- buildsOn: one line on how it grows from something in their record; empty if nothing fits. Never claim experience they do not have.
- Prefer projects that cover DIFFERENT problems, and that the roles in the postings would recognise.
- Doable in a home lab or free tiers; no paid enterprise licences.`;

  const user = [
    research.length
      ? `RESEARCH (last month):\n${research.map((hit) => `- ${hit.title ?? ""} | ${hit.url}\n  ${hit.snippet ?? ""}`).join("\n")}`
      : "RESEARCH: none available this time. Ground problems in the postings and the field's well-known, long-standing problems, and leave sourceUrls empty.",
    postings.length
      ? `POSTINGS they are pursuing:\n${postings.map((text, i) => `[${i + 1}] ${text}`).join("\n\n")}`
      : "",
    gaps.length ? `GAPS from their career report: ${gaps.join(", ")}` : "",
    record ? `THEIR RECORD:\n${record}` : "THEIR RECORD: nothing recorded yet.",
  ]
    .filter(Boolean)
    .join("\n\n");

  try {
    // Three detailed projects, and reasoning models think before they write: the default
    // budget ran out mid-answer on the owner's first try (Groq gpt-oss-120b, 29 Sep 2026).
    const raw = await generate.structured(system, user, schema, "flagship_projects", {
      maxTokens: 8000,
    });
    const flagships = acceptFlagships(raw.projects, research);
    if (flagships.length === 0) {
      return {
        ok: false,
        message: "No proposal held up against the research this time. Try again shortly.",
      };
    }
    await profiles.setFlagships(
      userId,
      track.id,
      flagships as unknown as Record<string, unknown>[]
    );
    logger.info("learning.flagships_refreshed", {
      userId,
      direction: track.targetRole,
      research: research.length,
      kept: flagships.length,
    });
    return { ok: true, state: await getFlagships(userId) };
  } catch (error) {
    logger.warn("learning.flagships_failed", {
      userId,
      error: error instanceof Error ? error.message : "unknown",
    });
    return {
      ok: false,
      message: "Couldn't research flagship projects just now. Try again shortly.",
    };
  }
}
