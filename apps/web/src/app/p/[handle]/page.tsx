import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { createPortfolioRepository } from "@careeros/database";

import { getDatabase } from "@/lib/database/client";
import { PortfolioTemplate, toPortfolioView } from "@careeros/portfolio";

export const dynamic = "force-dynamic";

async function load(handle: string) {
  const repo = createPortfolioRepository(getDatabase());
  const result = await repo.getPublishedByHandle(handle.trim().toLowerCase());
  return result ? toPortfolioView(result.site, result.items) : null;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ handle: string }>;
}): Promise<Metadata> {
  const { handle } = await params;
  const data = await load(handle);
  if (!data) return { title: "Portfolio not found" };
  const name = (data.site.profile as { name?: string })?.name || data.site.title;
  return { title: `${name} — Portfolio` };
}

export default async function PortfolioPage({ params }: { params: Promise<{ handle: string }> }) {
  const { handle } = await params;
  const data = await load(handle);
  if (!data) notFound();

  // The one seam vs. the static export: case studies live at /p/<handle>/<id> here.
  return <PortfolioTemplate data={data} itemHref={(id) => `/p/${handle}/${id}`} />;
}
