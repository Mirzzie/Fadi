"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { createJobsRepository, createSavedJobsRepository } from "@careeros/database";

import { getCurrentAuthUser } from "@/lib/auth/session";
import { getDatabase } from "@/lib/database/client";
import { isSafeFetchUrl } from "@/lib/security/url-guard";
import { detectAts, mapGreenhouse, mapLever, surfPage, type SurfedJob } from "@/lib/jobs/web-surfer";
import { logger } from "@/lib/observability/logger";

/**
 * ADD A JOB BY PASTING ITS LINK.
 *
 * Fadi's own discovery misses roles — measured on the owner's board: of the configured
 * providers, only Reed and Jooble return anything for Ireland at all. A person who finds a
 * posting themselves (LinkedIn, a company page, a friend's link) had no way to bring it in:
 * `surfCareerPage` reads a BOARD of many jobs, not the one posting in front of them.
 *
 * This reads the page the person chose, server-side, and keeps what the posting itself states —
 * title, company, location, description. Nothing is invented: if the page does not publish a
 * readable posting (a login wall, a JavaScript-only page), it says so and offers the manual path
 * rather than filling fields with guesses.
 */

export type ImportedJob = {
  jobId: string;
  title: string;
  company: string;
  location: string | null;
  hasDescription: boolean;
};

export async function importJobFromUrlAction(input: {
  url: string;
}): Promise<{ ok: true; job: ImportedJob } | { ok: false; message: string; manual?: boolean }> {
  const user = await getCurrentAuthUser();
  if (!user) return { ok: false, message: "Please sign in again." };

  const parsed = z.string().trim().min(4).max(2000).safeParse(input.url);
  if (!parsed.success) return { ok: false, message: "Paste the link to the job posting." };
  const url = parsed.data.includes("://") ? parsed.data : `https://${parsed.data}`;

  // The server fetches a URL the person typed, so the same guard the liveness probe uses:
  // no localhost, no private ranges, no hostname that resolves to one. Fails closed.
  if (!(await isSafeFetchUrl(url))) {
    return { ok: false, message: "That link can't be opened. Paste a public job posting URL." };
  }

  // Three ways to read one posting, cheapest first — measured 20 Sep: a plain fetch alone read
  // NONE of Greenhouse, LinkedIn or a career index, because those pages publish their posting in
  // JavaScript or behind a wall.
  //   1. The ATS's own API when the link is a Greenhouse/Lever posting — exact, no rendering.
  //   2. The page's structured data over a plain fetch.
  //   3. A real browser, which renders the page first (needs FADI_BROWSER_PATH or Playwright).
  const viaAts = await readFromAts(url);
  if (viaAts) return await persist(user.id, url, viaAts);

  const read = await surfPage(url);
  if (read.ok) {
    const posting = pickPosting(read.jobs, url);
    if (posting) return await persist(user.id, url, posting);
  }

  const viaBrowser = await readInBrowser(url);
  if (viaBrowser) return await persist(user.id, url, viaBrowser);

  if (!read.ok) {
    return {
      ok: false,
      manual: true,
      message: read.blocked
        ? "That site blocks Fadi from reading it (LinkedIn and Indeed usually do). Open the posting, copy its text, and add it by hand."
        : "Couldn't read that page. Check the link, or add the job by hand.",
    };
  }

  return {
    ok: false,
    manual: true,
    message: "That page doesn't publish a readable job posting. Add the job by hand instead.",
  };
}

async function persist(
  userId: string,
  url: string,
  posting: SurfedJob
): Promise<{ ok: true; job: ImportedJob }> {
  const db = getDatabase();
  const job = await createJobsRepository(db).upsertSeedJob({
    source: "imported",
    externalId: url.slice(0, 250),
    // PRIVATE to this person: a link they chose is not part of the systematic crawl, and must
    // not appear on anybody else's board.
    ownerUserId: userId,
    title: posting.title.trim().slice(0, 300),
    company: (posting.company ?? hostOf(url)).trim().slice(0, 200),
    location: posting.location?.trim() || null,
    description: posting.description?.trim() || null,
    url,
  });
  // Saved, because pasting a link is a statement of interest — it belongs on their board.
  await createSavedJobsRepository(db).saveForUser(userId, job.id, {});

  logger.info("jobs.imported_from_url", { userId, host: hostOf(url), jobId: job.id });
  revalidatePath("/dashboard/jobs");
  revalidatePath("/dashboard/applications");
  return {
    ok: true,
    job: {
      jobId: job.id,
      title: job.title,
      company: job.company,
      location: job.location,
      hasDescription: Boolean(job.description && job.description.length > 200),
    },
  };
}

/** Greenhouse and Lever publish the posting as JSON — exact text, no rendering, no scraping. */
async function readFromAts(url: string): Promise<SurfedJob | null> {
  const ats = detectAts(url);
  if (!ats) return null;
  const id = url.split("?")[0].split("/").filter(Boolean).pop();
  const numeric = /^\d+$/.test(id ?? "");
  const gh = new URL(url).searchParams.get("gh_jid");
  const jobId = gh ?? (numeric ? id : id);
  if (!jobId) return null;

  const endpoint =
    ats.kind === "greenhouse"
      ? `https://boards-api.greenhouse.io/v1/boards/${ats.token}/jobs/${jobId}?content=true`
      : `https://api.lever.co/v0/postings/${ats.token}/${jobId}`;
  try {
    const res = await fetch(endpoint, {
      headers: { "User-Agent": "Fadi/1.0 (career intelligence)" },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return null;
    const json = await res.json();
    const mapped =
      ats.kind === "greenhouse"
        ? mapGreenhouse({ jobs: [json] }, ats.token)
        : mapLever([json], ats.token);
    return mapped[0] ?? null;
  } catch {
    return null;
  }
}

/** Render the page in a real browser and read the posting off it. */
async function readInBrowser(url: string): Promise<SurfedJob | null> {
  try {
    const { scrapeJobPages } = await import(
      "@/lib/data-sources/providers/fadi-scraper/browser"
    );
    const [record] = await scrapeJobPages([url], 1);
    if (!record?.title) return null;
    return {
      title: record.title,
      company: record.company,
      location: record.location,
      description: record.description,
      url: record.url ?? url,
    };
  } catch {
    return null;
  }
}

/** The posting the link points at — a page may carry several (related roles, a board widget). */
function pickPosting(jobs: SurfedJob[], url: string): SurfedJob | null {
  const withTitle = jobs.filter((j) => j.title?.trim());
  if (withTitle.length === 0) return null;
  const exact = withTitle.find((j) => j.url && sameUrl(j.url, url));
  // Otherwise the richest one: the posting the page is ABOUT carries its full description.
  return (
    exact ??
    [...withTitle].sort((a, b) => (b.description?.length ?? 0) - (a.description?.length ?? 0))[0]
  );
}

function sameUrl(a: string, b: string): boolean {
  try {
    const x = new URL(a);
    const y = new URL(b);
    return x.host === y.host && x.pathname === y.pathname;
  } catch {
    return false;
  }
}

function hostOf(url: string): string {
  try {
    return new URL(url).host.replace(/^www\./, "");
  } catch {
    return "Unknown";
  }
}
