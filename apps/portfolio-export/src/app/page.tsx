import data from "@export/data/portfolio.json";
import { PortfolioTemplate, type PortfolioView } from "@careeros/portfolio";

// The portfolio IS the site root here, so a case study links to /<id>/ (not /p/<handle>/<id>).
export default function Home() {
  return (
    <PortfolioTemplate data={data as unknown as PortfolioView} itemHref={(id) => `/${id}/`} />
  );
}
