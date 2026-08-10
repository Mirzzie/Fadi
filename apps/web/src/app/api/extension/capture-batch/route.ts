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

const jobSchema = z.object({
  title: z.string().trim().min(1).max(300),
  // Optional: an anchor-only card may not resolve a company; we skip those at persist time
  // rather than reject the whole batch. url is kept lenient (not strict .url()) so an odd
  // href never sinks the request.
  company: z.string().trim().max(200).optional(),
  url: z.string().trim().max(1000).optional(),
  location: z.string().trim().max(200).optional(),
  description: z.string().max(20_000).optional(),
});

const schema = z.object({
  jobs: z.array(jobSchema).max(60).optional().default([]),
  // Cleaned page text for the AI self-healing fallback when the DOM selectors miss.
  pageText: z.string().max(20_000).optional(),
  source: z.string().trim().max(60).optional(),
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

    // Heuristic list from the extension's DOM scrape. If it's empty but we got page text,
    // let Fadi's AI read the jobs off the raw page (self-healing when selectors rot).
    type Item = { title?: string; company?: string; location?: string; url?: string; description?: string };
    let items: Item[] = parsed.data.jobs;
    let usedAi = false;
    if (items.length === 0 && parsed.data.pageText?.trim()) {
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
