import { NextResponse } from "next/server";

import { createJobsRepository, createSavedJobsRepository } from "@careeros/database";
import { z } from "zod";

import { getExtensionUser } from "@/lib/extension/auth";
import { getDatabase } from "@/lib/database/client";
import { logger } from "@/lib/observability/logger";

// Capture endpoint for the Fadi browser extension: it reads the job the user is looking at
// (on any site, incl. login-walled boards the server scraper can't reach) and saves it to
// their pipeline. Auth reuses the Fadi session (the extension sends credentials) — see the
// extension README for the SameSite/token caveat.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const captureSchema = z.object({
  title: z.string().trim().min(1).max(300),
  company: z.string().trim().min(1).max(200),
  url: z.string().url().optional(),
  location: z.string().trim().max(200).optional(),
  description: z.string().max(20_000).optional(),
});

/** Echo the caller's origin so credentialed CORS works (can't use "*" with credentials). */
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
  const parsed = captureSchema.safeParse(body);
  if (!parsed.success) {
    return withCors(NextResponse.json({ ok: false, error: "invalid" }, { status: 400 }), origin);
  }
  const d = parsed.data;

  try {
    const db = getDatabase();
    const jobs = createJobsRepository(db);
    const saved = createSavedJobsRepository(db);
    const externalId = (d.url ?? `${d.company}:${d.title}`).slice(0, 250);
    const job = await jobs.upsertSeedJob({
      source: "extension",
      externalId,
      title: d.title,
      company: d.company,
      location: d.location ?? null,
      description: d.description ?? null,
      url: d.url ?? null,
    });
    await saved.saveForUser(user.id, job.id, {});
    logger.info("extension.capture", { userId: user.id });
    return withCors(NextResponse.json({ ok: true, jobId: job.id }), origin);
  } catch (error) {
    logger.error("extension.capture_failed", {
      userId: user.id,
      error: error instanceof Error ? error.name : "unknown",
    });
    return withCors(NextResponse.json({ ok: false, error: "server" }, { status: 500 }), origin);
  }
}
