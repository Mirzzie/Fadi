import { NextResponse } from "next/server";

import { z } from "zod";

import { getCurrentAuthUser } from "@/lib/auth/session";
import { addReferralTarget } from "@/lib/network/referrals";
import { logger } from "@/lib/observability/logger";

// Network-capture: the extension grabs a referral target from a LinkedIn profile (name, role,
// company) into Fadi's network module, where the user can draft outreach. Real people the
// user is actually looking at — never fabricated contacts.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const schema = z.object({
  company: z.string().trim().min(1).max(200),
  contactName: z.string().trim().max(200).optional(),
  contactRole: z.string().trim().max(300).optional(),
  notes: z.string().trim().max(2000).optional(),
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
    await addReferralTarget(user.id, {
      company: parsed.data.company,
      contactName: parsed.data.contactName ?? null,
      contactRole: parsed.data.contactRole ?? null,
      channel: "linkedin",
      notes: parsed.data.notes ?? null,
    });
    logger.info("extension.contact", { userId: user.id });
    return withCors(NextResponse.json({ ok: true }), origin);
  } catch (error) {
    logger.error("extension.contact_failed", {
      userId: user.id,
      error: error instanceof Error ? error.name : "unknown",
    });
    return withCors(NextResponse.json({ ok: false, error: "server" }, { status: 500 }), origin);
  }
}
