import { createPortfolioRepository } from "@careeros/database";

import { getDatabase } from "@/lib/database/client";
import { toPortfolioView } from "@careeros/portfolio";

// Public, stack-agnostic Content API. Any website — our template or a third
// party's — reads a live portfolio here. Returns ONLY a published site and its
// published items; drafts and other users' data are never exposed.
//
// CORS is open (`*`) because this serves public, already-published content: it's
// meant to be fetched from any origin's browser (the "host your own site" story).

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}

export async function GET(_req: Request, { params }: { params: Promise<{ handle: string }> }) {
  const { handle } = await params;
  const normalized = handle.trim().toLowerCase();

  const repo = createPortfolioRepository(getDatabase());
  const result = await repo.getPublishedByHandle(normalized);
  if (!result) {
    return Response.json(
      { error: "Portfolio not found" },
      { status: 404, headers: CORS_HEADERS },
    );
  }

  const view = toPortfolioView(result.site, result.items);
  return Response.json(view, {
    headers: {
      ...CORS_HEADERS,
      // Cacheable at the edge; a publish action can revalidate.
      "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300",
    },
  });
}
