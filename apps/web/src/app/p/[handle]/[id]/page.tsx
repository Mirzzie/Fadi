import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { createPortfolioRepository } from "@careeros/database";

import { getDatabase } from "@/lib/database/client";
import { toPortfolioView } from "@/lib/portfolio/view";
import { CaseStudyTemplate } from "@/components/portfolio/case-study-template";

export const dynamic = "force-dynamic";

async function load(handle: string, id: string) {
  const repo = createPortfolioRepository(getDatabase());
  const result = await repo.getPublishedByHandle(handle.trim().toLowerCase());
  if (!result) return null;
  const view = toPortfolioView(result.site, result.items);
  const item = view.items.find((i) => i.id === id);
  return item ? { site: view.site, item } : null;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ handle: string; id: string }>;
}): Promise<Metadata> {
  const { handle, id } = await params;
  const data = await load(handle, id);
  if (!data) return { title: "Not found" };
  return { title: `${data.item.title} — ${data.site.title}` };
}

export default async function CaseStudyPage({
  params,
}: {
  params: Promise<{ handle: string; id: string }>;
}) {
  const { handle, id } = await params;
  const data = await load(handle, id);
  if (!data) notFound();

  return <CaseStudyTemplate site={data.site} item={data.item} backHref={`/p/${handle}`} />;
}
