import data from "@export/data/portfolio.json";
import type { PortfolioView } from "@/lib/portfolio/view";
import { CaseStudyTemplate } from "@/components/portfolio/case-study-template";

const view = data as unknown as PortfolioView;

// Pre-render one static page per portfolio item — the case studies.
export function generateStaticParams() {
  return view.items.map((i) => ({ id: i.id }));
}

export default async function CaseStudy({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const item = view.items.find((i) => i.id === id);
  if (!item) return null;
  // Portfolio is the site root here, so "back" goes to /.
  return <CaseStudyTemplate site={view.site} item={item} backHref="/" />;
}
