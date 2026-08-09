import "server-only";

import { z } from "zod";

import { getAIProvider } from "@/lib/ai/registry";

// AI-prompt job search: the user describes the job in plain language ("remote senior DevOps
// roles in Germany, €80k+, no crypto") and Fadi turns it into a structured intent — location
// filters the central discoverJobs engine already understands, plus post-filters (keywords /
// salary floor / exclusions). Scoped to the user's active career direction upstream.
// Doctrine: extract ONLY what the user actually said — never invent constraints.

export type JobSearchIntent = {
  keywords: string[];
  country?: string; // ISO-3166 alpha-2, lowercase
  city?: string;
  remote?: boolean;
  salaryMinK?: number; // thousands, e.g. 80 for €80k
  exclude?: string[];
};

const intentSchema = z.object({
  keywords: z.array(z.string()).describe("Role / skill / tech keywords the user wants. [] if none stated."),
  country: z
    .string()
    .optional()
    .describe("ISO-3166 alpha-2 country code (lowercase, e.g. 'de', 'ae', 'gb') if a country is named. Omit otherwise."),
  city: z.string().optional().describe("City if named."),
  remote: z.boolean().optional().describe("True ONLY if the user asks for remote."),
  salaryMinK: z.number().optional().describe("Minimum salary in thousands if stated (80 for 80k). Omit otherwise."),
  exclude: z.array(z.string()).optional().describe("Things to exclude, e.g. ['crypto']. [] if none."),
});

const SYSTEM =
  "You turn a job-seeker's plain-language request into a structured search. Extract ONLY what they actually say — never invent a location, salary or filter they didn't state. Omit anything not present.";

/** Parse a natural-language job request into a structured intent. Degrades to keywords-only. */
export async function parseJobPrompt(prompt: string): Promise<JobSearchIntent> {
  const text = prompt.trim();
  if (!text) return { keywords: [] };
  try {
    const provider = getAIProvider();
    const raw = await provider.parseStructured(
      [
        { role: "system", content: SYSTEM },
        { role: "user", content: text.slice(0, 2000) },
      ],
      intentSchema,
      "job_search_intent",
      { temperature: 0.1 },
    );
    return {
      keywords: (raw.keywords ?? []).map((k) => k.trim()).filter(Boolean),
      country: raw.country?.trim().toLowerCase() || undefined,
      city: raw.city?.trim() || undefined,
      remote: raw.remote,
      salaryMinK: typeof raw.salaryMinK === "number" && raw.salaryMinK > 0 ? raw.salaryMinK : undefined,
      exclude: (raw.exclude ?? []).map((e) => e.trim().toLowerCase()).filter(Boolean),
    };
  } catch {
    // No AI / failure: fall back to naive keywords so search still runs.
    return { keywords: text.split(/[^a-zA-Z0-9+#]+/).filter((w) => w.length > 2).slice(0, 6) };
  }
}

type FilterableJob = { title?: string; description?: string | null; salaryText?: string | null };

/** Pure post-filter: keep jobs matching the intent's keywords / salary floor / exclusions. */
export function applyIntentFilter<T extends FilterableJob>(jobs: T[], intent: JobSearchIntent): T[] {
  const kws = intent.keywords.map((k) => k.toLowerCase()).filter(Boolean);
  const excl = (intent.exclude ?? []).filter(Boolean);
  return jobs.filter((j) => {
    const hay = `${j.title ?? ""} ${j.description ?? ""}`.toLowerCase();
    if (kws.length && !kws.some((k) => hay.includes(k))) return false;
    if (excl.length && excl.some((e) => hay.includes(e))) return false;
    if (intent.salaryMinK != null) {
      const k = parseSalaryK(j.salaryText);
      if (k != null && k < intent.salaryMinK) return false; // drop only when we can read a lower salary
    }
    return true;
  });
}

/** Best-effort "€80k–€100k" / "$150,000" → the LOWER bound in thousands. null if unreadable. */
export function parseSalaryK(salaryText?: string | null): number | null {
  if (!salaryText) return null;
  const nums = [...salaryText.matchAll(/(\d[\d,.]*)\s*(k)?/gi)]
    .map((m) => {
      const n = Number(m[1].replace(/,/g, ""));
      if (Number.isNaN(n)) return null;
      return m[2] ? n : n >= 1000 ? n / 1000 : n; // "80k" → 80; "80000" → 80; "80" → 80
    })
    .filter((n): n is number => n != null && n > 0);
  return nums.length ? Math.min(...nums) : null;
}
