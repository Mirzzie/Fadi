import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { createPortfolioRepository } from "@careeros/database";

import { getDatabase } from "@/lib/database/client";
import { buildSnapshotHtml } from "@/lib/portfolio/snapshot";
import { toPortfolioView } from "@careeros/portfolio";

// Server-rendered static snapshot: the same self-contained index.html the client
// "Static snapshot" button produces, but served from a public URL so the Phase-B
// GitHub Actions refresh workflow can `curl` it (ADR 0008). Published sites only.
//
// One renderer: this and the client both call buildSnapshotHtml, so the two snapshot
// formats can never drift.

async function readSdk(): Promise<string> {
  // portfolio.js ships in public/; read it off disk rather than self-fetching.
  return readFile(join(process.cwd(), "public", "portfolio.js"), "utf8");
}

export async function GET(_req: Request, { params }: { params: Promise<{ handle: string }> }) {
  const { handle } = await params;
  const normalized = handle.trim().toLowerCase();

  const repo = createPortfolioRepository(getDatabase());
  const result = await repo.getPublishedByHandle(normalized);
  if (!result) {
    return new Response("Portfolio not found", { status: 404 });
  }

  const view = toPortfolioView(result.site, result.items);
  const sdk = await readSdk();
  const html = buildSnapshotHtml({ sdk, view, handle: normalized });

  return new Response(html, {
    headers: {
      "content-type": "text/html; charset=utf-8",
      "Access-Control-Allow-Origin": "*",
      // Cacheable at the edge; a publish revalidates.
      "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300",
    },
  });
}
