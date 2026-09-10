import data from "@export/data/portfolio.json";
import { PortfolioTemplate, type PortfolioView } from "@careeros/portfolio";

// The portfolio IS the site root here, so a case study links to /<id>/ (not /p/<handle>/<id>).
export default function Home() {
  return (
    <PortfolioTemplate
      data={data as unknown as PortfolioView}
      itemHref={(id) => `/${id}/`}
      // This copy is static and served from someone else's host (GitHub Pages), so it
      // has no /api of its own. Reporting only works if a PUBLICLY REACHABLE collector
      // is set at build time — a Fadi on localhost is not one, and pointing here at
      // localhost would make each visitor's browser post to its own machine.
      // Unset = no reporting, which is the correct default rather than 404s per click.
      analyticsBase={process.env.NEXT_PUBLIC_PORTFOLIO_ANALYTICS_URL || null}
    />
  );
}
