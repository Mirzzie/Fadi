import { NextResponse } from "next/server";

import { createEvidenceRepository } from "@careeros/database";
import { z } from "zod";

import { getCurrentAuthUser } from "@/lib/auth/session";
import { getDatabase } from "@/lib/database/client";
import { logger } from "@/lib/observability/logger";

// Evidence-clip: the extension sends a win/achievement the user selected on any page (a
// LinkedIn post, a project page, a shipped feature) straight into their evidence pool.
// Doctrine: it's the user's own real detail — nothing invented.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const schema = z.object({
  title: z.string().trim().min(1).max(200),
  detail: z.string().trim().min(1).max(4000),
});

function withCors(res: NextResponse, origin: string | null): NextResponse {
  res.headers.set("Access-Control-Allow-Origin", origin ?? "*");
  res.headers.set("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.headers.set("Access-Control-Allow-Headers", "Content-Type");
  res.headers.set("Access-Control-Allow-Credentials", "true");
  res.headers.set("Vary", "Origin");
  return res;
}

export function OPTIONS(req: Request) {
  return withCors(new NextResponse(null, { status: 204 }), req.headers.get("origin"));
}

export async function POST(req: Request) {
  const origin = req.headers.get("origin");
  const user = await getCurrentAuthUser();
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
    await createEvidenceRepository(getDatabase()).create(user.id, {
      kind: "achievement",
      title: parsed.data.title,
      detail: parsed.data.detail,
      origin: "extension",
    });
    logger.info("extension.evidence", { userId: user.id });
    return withCors(NextResponse.json({ ok: true }), origin);
  } catch (error) {
    logger.error("extension.evidence_failed", {
      userId: user.id,
      error: error instanceof Error ? error.name : "unknown",
    });
    return withCors(NextResponse.json({ ok: false, error: "server" }, { status: 500 }), origin);
  }
}
