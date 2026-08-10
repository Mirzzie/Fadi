import { NextResponse } from "next/server";

import { createJobsRepository, createSavedJobsRepository } from "@careeros/database";
import { z } from "zod";

import { getExtensionUser } from "@/lib/extension/auth";
import { getDatabase } from "@/lib/database/client";
import { aiExtractJobs } from "@/lib/data-sources/providers/fadi-scraper/ai-extract";
import { logger } from "@/lib/observability/logger";

// Bulk capture: the extension scrapes a whole portal SEARCH page (in the user's own session,
// so it reads results a server scraper can't) and sends the list here. This is how "search
// the internet like a human" reaches Fadi — the human's real browser did the scraping.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Clamp any string to `n` chars instead of REJECTING it — a real listing must never be lost
// because e.g. Indeed's tracking URL runs past a length cap (that caused "Failed: invalid").
const clamped = (n: number) =>
  z.preprocess((v) => (typeof v === "string" ? v.slice(0, n) : v == null ? undefined : v), z.string().optional());

const jobSchema = z.object({
  // All optional + clamped; the persist loop keeps only rows with a real title AND company
  // (doctrine: never invent a company), so bad rows are skipped, never fabricated.
  title: clamped(300),
  company: clamped(200),
  url: clamped(2000),
  location: clamped(200),
  description: clamped(20_000),
});

const schema = z.object({
  jobs: z.array(jobSchema).max(120).optional().default([]),
  // Cleaned page text for the AI self-healing fallback when the DOM selectors miss.
  pageText: z.preprocess((v) => (typeof v === "string" ? v.slice(0, 20_000) : v), z.string().optional()),
  source: clamped(60),
});

function withCors(res: NextResponse, origin: string | null): NextResponse {
  res.headers.set("Access-Control-Allow-Origin", origin ?? "*");
  res.headers.set("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.headers.set("Access-Control-Allow-Credentials", "true");
  res.headers.set("Vary", "Origin");
  return res;
}

export function OPTIONS(req: Request) {
  return withCors(new NextResponse(null, { status: 204 }), req.headers.get("origin"));
}

export async function POST(req: Request) {
  const origin = req.headers.get("origin");
  const user = await getExtensionUser(req);
  if (!user) {
    return withCors(NextResponse.json({ ok: false, error: "not_authenticated" }, { status: 401 }), origin);
  }
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return withCors(NextResponse.json({ ok: false, error: "bad_json" }, { status: 400 }), origin);
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return withCors(NextResponse.json({ ok: false, error: "invalid" }, { status: 400 }), origin);
  }

  try {
    const db = getDatabase();
    const jobsRepo = createJobsRepository(db);
    const savedRepo = createSavedJobsRepository(db);

    // Heuristic list from the extension's DOM scrape. A job is only usable if it has BOTH a
    // title and a company (doctrine: we never invent a company). If the selectors rotted and
    // produced no usable rows, fall back to Fadi's AI reading the raw page text — that's what
    // makes scraping self-heal instead of silently returning "no jobs".
    type Item = { title?: string; company?: string; location?: string; url?: string; description?: string };
    let items: Item[] = parsed.data.jobs;
    const usable = (list: Item[]) => list.filter((d) => d.title?.trim() && d.company?.trim()).length;
    let usedAi = false;
    if (usable(items) === 0 && parsed.data.pageText?.trim()) {
      items = await aiExtractJobs(parsed.data.pageText, parsed.data.source ?? "job board");
      usedAi = true;
    }

    let saved = 0;
    for (const d of items) {
      // Doctrine: never invent. A card with no real company is skipped, not filled in.
      const title = d.title?.trim();
      const company = d.company?.trim();
      if (!title || !company) continue;
      try {
        const externalId = (d.url ?? `${company}:${title}`).slice(0, 250);
        const job = await jobsRepo.upsertSeedJob({
          source: "extension",
          externalId,
          title,
          company,
          location: d.location ?? null,
          description: d.description ?? null,
          url: d.url ?? null,
        });
        await savedRepo.saveForUser(user.id, job.id, {});
        saved += 1;
      } catch {
        /* skip the one that failed; keep the batch going */
      }
    }
    logger.info("extension.capture_batch", { userId: user.id, count: saved, usedAi });
    return withCors(NextResponse.json({ ok: true, saved, usedAi }), origin);
  } catch (error) {
    logger.error("extension.capture_batch_failed", {
      userId: user.id,
      error: error instanceof Error ? error.name : "unknown",
    });
    return withCors(NextResponse.json({ ok: false, error: "server" }, { status: 500 }), origin);
  }
}
