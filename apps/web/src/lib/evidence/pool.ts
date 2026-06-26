import { z } from "zod";

import type { EvidenceItem } from "@careeros/database";

/**
 * The shared evidence pool — the multi-track moat. The user's real experience is
 * stored ONCE as discrete items; each career track *ranks and frames* the same pool
 * differently. A "patient care" item is top evidence for a Nursing track and near-
 * irrelevant for a Software track — same item, different priority — which is exactly
 * what lets one person run several career identities over one truthful history.
 *
 * Pure helpers (evidenceRelevance / rankEvidenceForTrack) are unit-tested and are
 * the graph's intelligence; AI extraction + persistence load dynamically. Grounded
 * only in the user's real history — never invents experience.
 */

export type EvidenceKind = "experience" | "project" | "achievement" | "skill" | "education";

export type EvidenceView = {
  id: string;
  kind: EvidenceKind;
  title: string;
  organization: string | null;
  period: string | null;
  detail: string;
  metrics: string | null;
  tags: string[];
  origin: string;
};

const KINDS: EvidenceKind[] = ["experience", "project", "achievement", "skill", "education"];
export function normKind(s?: string): EvidenceKind {
  const k = (s ?? "").toLowerCase().trim();
  return (KINDS as string[]).includes(k) ? (k as EvidenceKind) : "experience";
}

export function toEvidenceView(row: EvidenceItem): EvidenceView {
  return {
    id: row.id,
    kind: normKind(row.kind),
    title: row.title,
    organization: row.organization,
    period: row.period,
    detail: row.detail,
    metrics: row.metrics,
    tags: Array.isArray(row.tags) ? row.tags : [],
    origin: row.origin,
  };
}

/** The terms a track cares about — its role, field, and known title synonyms. */
export type TrackTerms = { role: string; domain?: string | null; synonyms?: string[] };

const STOP = new Set([
  "the", "and", "for", "with", "from", "into", "that", "this", "was", "were", "are",
  "you", "your", "our", "their", "his", "her", "led", "the", "a", "an", "of", "to", "in", "on", "at",
]);

function tokens(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9+#.\s-]/g, " ")
    .split(/[\s-]+/)
    .map((w) => w.trim())
    .filter((w) => w.length > 2 && !STOP.has(w));
}

/**
 * How relevant one evidence item is to a track. Tag hits (curated skills/domains)
 * count more than incidental word overlap. Pure + deterministic.
 */
export function evidenceRelevance(item: EvidenceView, track: TrackTerms): { score: number; matched: string[] } {
  const trackTerms = new Set([
    ...tokens(track.role ?? ""),
    ...tokens(track.domain ?? ""),
    ...(track.synonyms ?? []).flatMap(tokens),
  ]);
  if (trackTerms.size === 0) return { score: 0, matched: [] };

  const matched = new Set<string>();
  let score = 0;

  for (const tag of item.tags.map((t) => t.toLowerCase().trim())) {
    const tagToks = tokens(tag);
    if (tagToks.some((tt) => trackTerms.has(tt))) {
      score += 5;
      matched.add(tag);
    }
  }
  for (const w of tokens(`${item.title} ${item.organization ?? ""} ${item.detail}`)) {
    if (trackTerms.has(w)) {
      score += 2;
      matched.add(w);
    }
  }

  return { score, matched: [...matched].slice(0, 6) };
}

export type RankedEvidence = { item: EvidenceView; score: number; matched: string[] };

/**
 * A prompt block of the candidate's TOP evidence for the active track — the bridge
 * that makes the pool actually power generation (documents, interview prep, fit).
 * "Lead with these, framed for this role." Empty string when the pool has nothing
 * relevant, so callers can append unconditionally. Pure + testable.
 */
export function formatTopEvidence(ranked: RankedEvidence[], max = 8): string {
  const top = ranked.filter((r) => r.score > 0).slice(0, max);
  if (top.length === 0) return "";
  const lines = top.map(({ item }) => {
    const head = `- [${item.kind}] ${item.title}${item.organization ? ` @ ${item.organization}` : ""}${item.period ? ` (${item.period})` : ""}`;
    const body = [item.detail, item.metrics].filter(Boolean).join(" — ");
    return body ? `${head}: ${body}` : head;
  });
  return `MOST RELEVANT EVIDENCE FOR THIS DIRECTION (the candidate's own, ranked for this role — lead with these and frame them for the target role; never invent beyond them):\n${lines.join("\n")}`;
}

/** Rank the whole pool for a track — most relevant first; everything stays in the pool. */
export function rankEvidenceForTrack(items: EvidenceView[], track: TrackTerms): RankedEvidence[] {
  return items
    .map((item) => ({ item, ...evidenceRelevance(item, track) }))
    .sort((a, b) => b.score - a.score);
}

// ── AI extraction (grounded in real history) ────────────────────────────────────
const poolSchema = z.object({
  items: z
    .array(
      z.object({
        kind: z.string().optional(),
        title: z.string(),
        organization: z.string().optional(),
        period: z.string().optional(),
        detail: z.string().optional(),
        metrics: z.string().optional(),
        tags: z.array(z.string()).default([]),
      }),
    )
    .max(40),
});

const EXTRACT_SYSTEM = `You are building a candidate's "evidence pool": discrete, reusable pieces of their REAL career, independent of any one job.
Extract items of kind: experience (a role held), project, achievement, skill, education.
Rules:
- Use ONLY the evidence provided. Never invent roles, employers, dates, metrics, or skills.
- One item per real thing. Keep detail tight and factual. Put real numbers/outcomes in "metrics".
- tags = lowercase skills/domains/tools keywords for that item (these power per-track relevance) — only ones genuinely supported by the evidence.
- If the history is thin, return fewer items. Never pad.`;

export type ExtractResult =
  | { ok: true; items: EvidenceView[] }
  | { ok: false; reason: "no_evidence" | "no_provider" | "empty"; message: string };

export async function extractEvidencePool(userId: string): Promise<ExtractResult> {
  const [{ getCareerReportContext }, { composeCareerEvidence }, { getUserDocGenerate }, { createEvidenceRepository }, { getDatabase }] =
    await Promise.all([
      import("@/lib/career-report/data"),
      import("@/lib/career/evidence"),
      import("@/lib/ai/user-generate"),
      import("@careeros/database"),
      import("@/lib/database/client"),
    ]);

  const ctx = await getCareerReportContext(userId);
  const evidence = composeCareerEvidence({ resumeText: ctx?.resumeText, linkedInText: ctx?.linkedInProfileText });
  if (evidence.historySource === "none") {
    return { ok: false, reason: "no_evidence", message: "Add your LinkedIn or résumé first, and I'll build your evidence pool from your real experience." };
  }

  const generate = await getUserDocGenerate(userId);
  if (!generate) return { ok: false, reason: "no_provider", message: "Connect an AI provider in Settings to build your evidence pool." };

  let parsed: z.infer<typeof poolSchema>;
  try {
    parsed = await generate.structured(EXTRACT_SYSTEM, evidence.block, poolSchema, "evidence_pool");
  } catch {
    return { ok: false, reason: "empty", message: "I couldn't build the pool just now — please try again." };
  }

  const clean = (parsed.items ?? []).filter((i) => i.title?.trim());
  if (clean.length === 0) {
    return { ok: false, reason: "empty", message: "Not enough concrete detail in your history yet — add more to your LinkedIn/résumé and try again." };
  }

  const repo = createEvidenceRepository(getDatabase());
  const created = await repo.createMany(
    userId,
    clean.map((i) => ({
      kind: normKind(i.kind),
      title: i.title.trim(),
      organization: i.organization?.trim() || null,
      period: i.period?.trim() || null,
      detail: (i.detail ?? "").trim(),
      metrics: i.metrics?.trim() || null,
      tags: (i.tags ?? []).map((t) => t.toLowerCase().trim()).filter(Boolean).slice(0, 8),
      origin: "ai",
    })),
  );
  return { ok: true, items: created.map(toEvidenceView) };
}

export async function listEvidence(userId: string): Promise<EvidenceView[]> {
  const { createEvidenceRepository } = await import("@careeros/database");
  const { getDatabase } = await import("@/lib/database/client");
  const rows = await createEvidenceRepository(getDatabase()).listForUser(userId);
  return rows.map(toEvidenceView);
}

/** The evidence pool ranked for the user's ACTIVE track — the framed view. */
export async function rankedEvidenceForActiveTrack(
  userId: string,
): Promise<{ track: { role: string; domain: string | null } | null; ranked: RankedEvidence[] }> {
  const [{ createCareerProfilesRepository, createEvidenceRepository }, { getDatabase }] = await Promise.all([
    import("@careeros/database"),
    import("@/lib/database/client"),
  ]);
  const db = getDatabase();
  const [rows, active] = await Promise.all([
    createEvidenceRepository(db).listForUser(userId),
    createCareerProfilesRepository(db).getActiveForUser(userId),
  ]);
  const items = rows.map(toEvidenceView);
  if (!active?.targetRole) return { track: null, ranked: items.map((item) => ({ item, score: 0, matched: [] })) };

  const ranked = rankEvidenceForTrack(items, {
    role: active.targetRole,
    domain: active.domain,
    synonyms: active.roleSynonyms ?? [],
  });
  return { track: { role: active.targetRole, domain: active.domain }, ranked };
}

/** Top-evidence prompt block for the active track — "" when the pool is empty/irrelevant. */
export async function topEvidenceForPrompt(userId: string, max = 8): Promise<string> {
  const { ranked } = await rankedEvidenceForActiveTrack(userId);
  return formatTopEvidence(ranked, max);
}
