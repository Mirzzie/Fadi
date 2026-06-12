import "server-only";

import { z } from "zod";

import type { DocGenerate } from "@/lib/documents/generate";

/**
 * Domain-agnostic role-synonym expansion. Given a user's target role(s) — in
 * ANY field (nursing, finance, trades, tech, design…) — Scout returns the
 * equivalent job-title phrases hiring teams actually use, so matching catches
 * title variants ("Registered Nurse" ↔ "Staff Nurse" ↔ "RN") for everyone, not
 * just the IT roles a hardcoded map happened to cover.
 */

const MAX_SYNONYMS = 24;
const schema = z.object({ synonyms: z.array(z.string()).max(60) });

const SYSTEM = `You expand a job seeker's target role into the equivalent job-TITLE phrases that hiring teams use for the SAME kind of role, in their field — whatever the field is (healthcare, finance, skilled trades, education, law, tech, creative, etc.).
Rules:
- Return real title phrases someone would see in a posting (e.g. for "Registered Nurse": "staff nurse", "rn", "charge nurse", "clinical nurse"; for "Financial Analyst": "fp&a analyst", "finance analyst", "investment analyst").
- Lowercase, no seniority prefixes alone (don't return bare "senior"/"junior"), no duplicates, no generic words ("professional", "specialist" on their own).
- Only equivalents of the SAME role family — never adjacent-but-different roles.
- 8–20 phrases. If the role is already specific, fewer is fine.`;

/** Expand role(s) into lowercased, deduped equivalent title phrases. Best-effort. */
export async function expandRoleSynonyms(
  roles: string[],
  generate: DocGenerate,
): Promise<string[]> {
  const seeds = roles.map((r) => r.trim()).filter(Boolean);
  if (seeds.length === 0) return [];

  const user = `Target role(s): ${seeds.join("; ")}\nReturn the equivalent job-title phrases.`;
  const result = await generate.structured(SYSTEM, user, schema, "role_synonyms");

  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of result.synonyms) {
    const term = raw.toLowerCase().trim();
    if (term.length < 2 || seen.has(term)) continue;
    seen.add(term);
    out.push(term);
    if (out.length >= MAX_SYNONYMS) break;
  }
  // Always include the seeds themselves (lowercased) as a floor.
  for (const s of seeds) {
    const t = s.toLowerCase().trim();
    if (t && !seen.has(t)) {
      seen.add(t);
      out.push(t);
    }
  }
  return out;
}
