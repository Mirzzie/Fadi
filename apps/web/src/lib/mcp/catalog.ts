import "server-only";

import { createApplicationsRepository, createCareerProfilesRepository } from "@careeros/database";

import { getDashboardProfileSummary } from "@/lib/career-report/data";
import { getDatabase } from "@/lib/database/client";
import type { McpResource, McpResourceContents, McpToolAnnotations } from "./server";

// ── Tool annotations ─────────────────────────────────────────────────────────
// Advisory behaviour hints per tool (spec "annotations"). They let a client show
// the right confirm/undo UX before calling — this is the mechanical enforcement
// point behind Fadi's "destructive/mutating actions need explicit sign-off" rule,
// which was prose-only until now.
const READ_ONLY: McpToolAnnotations = { readOnlyHint: true, idempotentHint: true, openWorldHint: false };
const READ_ONLY_EXTERNAL: McpToolAnnotations = { readOnlyHint: true, idempotentHint: true, openWorldHint: true };
const WRITE: McpToolAnnotations = { readOnlyHint: false, destructiveHint: false, idempotentHint: false };

const TOOL_ANNOTATIONS: Record<string, McpToolAnnotations> = {
  // Read-only, hits live EXTERNAL data (jobs, ATS boards, labor/world signals).
  search_jobs: READ_ONLY_EXTERNAL,
  get_career_updates: READ_ONLY_EXTERNAL,
  scan_company_jobs: READ_ONLY_EXTERNAL,
  get_labor_market: READ_ONLY_EXTERNAL,
  get_world_shifts: READ_ONLY_EXTERNAL,
  // Read-only over the user's OWN data (analysis/prep; no writes, no outside world).
  get_performance: READ_ONLY,
  get_momentum_reflection: READ_ONLY,
  get_rejection_patterns: READ_ONLY,
  prep_interview: READ_ONLY,
  company_interview_brief: READ_ONLY,
  mock_interview_questions: READ_ONLY,
  score_interview_answer: READ_ONLY,
  get_relevant_evidence: READ_ONLY,
  answer_behavioral_question: READ_ONLY,
  evaluate_fit: READ_ONLY,
  // Mutating (create records) — not destructive, not idempotent (a second call
  // adds another). These are the ones a client should confirm before calling.
  draft_referral_outreach: WRITE,
  generate_document: WRITE,
  track_application: WRITE,
  create_career_track: WRITE,
};

export function getFadiToolAnnotations(name: string): McpToolAnnotations | undefined {
  return TOOL_ANNOTATIONS[name];
}

// ── Resources ────────────────────────────────────────────────────────────────
// Read-only, browsable views of the caller's own data — same user, same token,
// same boundary as the tools, so no new privacy surface.
export function listFadiResources(): McpResource[] {
  return [
    {
      uri: "fadi://profile",
      name: "Profile",
      description:
        "The user's active-direction profile summary — name, target role, location, experience, goals.",
      mimeType: "application/json",
    },
    {
      uri: "fadi://applications",
      name: "Applications",
      description:
        "The user's job applications for the active direction — company, title, status, applied date.",
      mimeType: "application/json",
    },
    {
      uri: "fadi://tracks",
      name: "Career tracks",
      description: "The user's career directions — label, target role, domain, and which is active.",
      mimeType: "application/json",
    },
  ];
}

export async function readFadiResource(
  userId: string,
  uri: string,
): Promise<McpResourceContents | null> {
  const db = getDatabase();
  switch (uri) {
    case "fadi://profile": {
      const p = await getDashboardProfileSummary(userId);
      return asJson(uri, p ?? {});
    }
    case "fadi://tracks": {
      const tracks = await createCareerProfilesRepository(db).listForUser(userId);
      return asJson(
        uri,
        tracks.map((t) => ({
          id: t.id,
          label: t.label ?? t.targetRole,
          targetRole: t.targetRole,
          domain: t.domain,
          intent: t.intent,
          isActive: t.isActive,
        })),
      );
    }
    case "fadi://applications": {
      const active = await createCareerProfilesRepository(db).getActiveForUser(userId);
      const apps = await createApplicationsRepository(db).listForUser(
        userId,
        active ? { scope: "active", careerProfileId: active.id } : { scope: "all" },
      );
      return asJson(
        uri,
        apps.map((a) => ({
          id: a.id,
          company: a.company,
          title: a.title,
          status: a.status,
          url: a.url,
          appliedAt: a.appliedAt ? a.appliedAt.toISOString() : null,
        })),
      );
    }
    default:
      return null;
  }
}

function asJson(uri: string, data: unknown): McpResourceContents {
  return { uri, mimeType: "application/json", text: JSON.stringify(data, null, 2) };
}
