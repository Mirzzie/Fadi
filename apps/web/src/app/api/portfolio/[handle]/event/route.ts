import { NextResponse } from "next/server";

import { createPortfolioRepository } from "@careeros/database";

import { getDatabase } from "@/lib/database/client";
import { isPortfolioEvent, recordPortfolioEvent } from "@/lib/portfolio/analytics";

/**
 * Visitor-event beacon for a PUBLIC portfolio.
 *
 * Unauthenticated by necessity — the whole point is anonymous readers — so it is
 * written to be boring on purpose:
 *   - only published sites are addressable,
 *   - only the closed set of event names is accepted,
 *   - the response is always 204 with no body, so it can never be used to probe
 *     which handles exist,
 *   - nothing the caller sends becomes an identifier; the visitor pseudonym is
 *     derived server-side and the caller cannot influence it.
 *
 * CORS is open because the static GitHub Pages export of a portfolio lives on a
 * different origin and must be able to report back to its own Fadi instance.
 * Nothing here is readable cross-origin — it only accepts writes and returns 204.
 */

export const dynamic = "force-dynamic";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "content-type",
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS });
}

export async function POST(request: Request, { params }: { params: Promise<{ handle: string }> }) {
  // One response for every outcome — success, unknown handle, bad payload. An
  // endpoint that answers differently is a handle-enumeration oracle.
  const done = new NextResponse(null, { status: 204, headers: CORS });

  try {
    const { handle } = await params;
    const body = (await request.json().catch(() => null)) as {
      type?: unknown;
      itemId?: unknown;
      title?: unknown;
      role?: unknown;
      interest?: unknown;
      // Which kind of contact link, and the referring hostname. Kept in step with the
      // Cloudflare collector so the same page reports the same shape either way.
      kind?: unknown;
      ref?: unknown;
      self?: unknown;
    } | null;

    if (!body || !isPortfolioEvent(body.type)) return done;

    const site = await createPortfolioRepository(getDatabase()).getPublishedByHandle(
      handle.trim().toLowerCase()
    );
    if (!site) return done;

    const str = (v: unknown) => (typeof v === "string" ? v : undefined);
    await recordPortfolioEvent({
      ownerUserId: site.site.userId,
      siteId: site.site.id,
      type: body.type,
      headers: request.headers,
      // Self-reported by a browser the owner marked with `?not-me=1`. Trusting the
      // client here is safe: the only thing a caller can do with it is exclude
      // themselves, which is exactly what the flag is for.
      self: body.self === true,
      detail: {
        itemId: str(body.itemId),
        title: str(body.title),
        role: str(body.role),
        interest: str(body.interest),
        kind: str(body.kind),
        ref: str(body.ref),
      },
    });
  } catch {
    // Analytics must never surface an error to a reader.
  }

  return done;
}
