import "server-only";

import { z } from "zod";

import { getAIProvider } from "@/lib/ai/registry";

import type { ScrapedRecord } from "./recipes";

// The 2026 AI-scraper approach (Firecrawl/ScrapeGraphAI-style): instead of brittle CSS
// selectors, the browser renders the page, and an LLM extracts structured jobs from the
// cleaned page text against a schema — self-healing when a site's layout changes. Uses the
// server-default provider (a system task, not a user's BYOK key). Doctrine: NEVER invent —
// the model may only return jobs actually present in the text.

const extractionSchema = z.object({
  jobs: z
    .array(
      z.object({
        title: z.string().describe("Exact job title as shown."),
        company: z.string().describe("Hiring company/organisation."),
        location: z.string().optional().describe("Location text if shown (city/remote)."),
        url: z.string().optional().describe("The listing's link/href if present."),
      }),
    )
    .describe("Every distinct job posting present on the page. Empty if none."),
});

const SYSTEM = [
  "You extract job postings from the text of a job-board search-results page.",
  "Return ONLY jobs that are actually present in the text — never invent, never guess a company or title that isn't there.",
  "Omit any field you cannot find. If there are no job postings, return an empty list.",
].join(" ");

/** AI-extract job records from rendered page text. Returns [] if AI is unavailable/fails. */
export async function aiExtractJobs(pageText: string, sourceName: string): Promise<ScrapedRecord[]> {
  const text = pageText.trim();
  if (!text) return [];
  try {
    const provider = getAIProvider(); // server-default; throws if no AI key configured
    const raw = await provider.parseStructured(
      [
        { role: "system", content: SYSTEM },
        { role: "user", content: `Source: ${sourceName}\n\nPage content:\n${text.slice(0, 12_000)}` },
      ],
      extractionSchema,
      "job_extraction",
      { temperature: 0.1 },
    );
    return (raw.jobs ?? [])
      .filter((j) => j.title?.trim() && j.company?.trim())
      .map((j) => ({ title: j.title, company: j.company, location: j.location, url: j.url }));
  } catch {
    return [];
  }
}
