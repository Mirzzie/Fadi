import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { createPortfolioRepository } from "@careeros/database";

import { getCurrentAuthUser } from "@/lib/auth/session";
import { getDatabase } from "@/lib/database/client";
import { recordPortfolioEvent } from "@/lib/portfolio/analytics";
import { PortfolioTemplate, toPortfolioView } from "@careeros/portfolio";

export const dynamic = "force-dynamic";

async function load(handle: string) {
  const repo = createPortfolioRepository(getDatabase());
  const result = await repo.getPublishedByHandle(handle.trim().toLowerCase());
  if (!result) return null;
  // The raw site travels with the view so the page can attribute a visit to its
  // owner without a second query. generateMetadata uses the view half only.
  return { view: toPortfolioView(result.site, result.items), site: result.site };
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ handle: string }>;
}): Promise<Metadata> {
  const { handle } = await params;
  const data = await load(handle);
  if (!data) return { title: "Portfolio not found" };
  const name = (data.view.site.profile as { name?: string })?.name || data.view.site.title;
  return { title: `${name} — Portfolio` };
}

export default async function PortfolioPage({ params }: { params: Promise<{ handle: string }> }) {
  const { handle } = await params;
  const data = await load(handle);
  if (!data) notFound();

  // A view is logged HERE and not in generateMetadata, which Next also calls —
  // counting both would double every visit. Server-side means it survives
  // ad-blockers and needs no cookie or client script to work.
  //
  // A self-visit is FLAGGED, not counted. These numbers are meant to become a signal
  // ("someone came for your safeguarding work the week you applied"), so the owner
  // previewing their own page all afternoon would manufacture interest that does not
  // exist. Fadi never invents evidence, and that has to include evidence of attention.
  const { headers } = await import("next/headers");
  const viewer = await getCurrentAuthUser();
  await recordPortfolioEvent({
    ownerUserId: data.site.userId,
    siteId: data.site.id,
    type: "view",
    headers: await headers(),
    self: viewer?.id === data.site.userId,
  });

  // The one seam vs. the static export: case studies live at /p/<handle>/<id> here.
  return (
    // Same-origin: this copy is served BY Fadi, so its own /api is reachable.
    <PortfolioTemplate
      data={data.view}
      itemHref={(id) => `/p/${handle}/${id}`}
      analyticsBase=""
    />
  );
}
