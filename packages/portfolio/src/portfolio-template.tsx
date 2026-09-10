import type { PortfolioView } from "./view";
import { WorkTemplate } from "./work-template";

/**
 * THE portfolio renderer. One design, deliberately.
 *
 * There used to be four (noir-gold / aurora / minimal / plain) and a picker to switch
 * between them. That was a menu, not a product: three of the four were the same
 * résumé in different colours, none of them was maintained as well as the one people
 * actually used, and every new feature had to be built four times or silently work in
 * only one. Variety in a portfolio belongs in the WORK it shows, not in chrome.
 *
 * This name is kept so the live route and the static export (ADR 0009) keep importing
 * one component, which is what stops them drifting apart.
 */
export function PortfolioTemplate({
  data,
  itemHref,
  analyticsBase,
}: {
  data: PortfolioView;
  /** Where a case study links to. The single seam between live and static builds. */
  itemHref: (id: string) => string;
  /** See PortfolioAnalytics: omit to disable visitor reporting (the default). */
  analyticsBase?: string | null;
}) {
  return <WorkTemplate data={data} itemHref={itemHref} analyticsBase={analyticsBase} />;
}
