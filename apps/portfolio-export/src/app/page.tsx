import data from "@export/data/portfolio.json";
import type { PortfolioView } from "@/lib/portfolio/view";
import { PortfolioTemplate } from "@/components/portfolio/portfolio-template";

// The portfolio IS the site root here, so a case study links to /<id>/ (not /p/<handle>/<id>).
export default function Home() {
  return (
    <PortfolioTemplate data={data as unknown as PortfolioView} itemHref={(id) => `/${id}/`} />
  );
}
