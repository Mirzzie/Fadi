/**
 * A COMPANY'S JOB BOARD IS NOT A DEAD END.
 *
 * Measured on a live Dublin crawl (21 Sep 2026): 29 search results, 5 pages readable, 2 jobs.
 * Most results were not postings at all — they were a company's board index
 * (job-boards.greenhouse.io/tines, apply.workable.com/tekenable/), which carries no JobPosting
 * JSON-LD and was therefore dropped in silence. A person would click into the listings; the
 * crawler stopped at the door.
 *
 * These helpers decide what on such a page is a posting worth opening. Pure, so the rules can be
 * tested without a browser: ATS posting URLs are recognisable by shape, and a board only ever
 * links to its own postings — following anything else would turn a crawl into a web walk.
 */

/** URL shapes the big ATS platforms use for ONE posting (not a board, not a filter view). */
const POSTING_SHAPES: RegExp[] = [
  /\/jobs?\/\d{4,}/i, // greenhouse: /acme/jobs/6161206004
  // ashby (/notion/<uuid>) and lever (/acme/<uuid>) name a posting by id alone, with no
  // "jobs" segment to key on.
  /\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i,
  /workable\.com\/[^/]+\/j\/[A-Z0-9]{6,}/i, // workable
  /smartrecruiters\.com\/[^/]+\/\d{9,}/i, // smartrecruiters
  /bamboohr\.com\/careers\/\d+/i, // bamboohr
  /\/(job|opening|vacancy)\/[A-Za-z0-9][\w-]{5,}/i, // common career-page shape
];

/** Is this one posting, rather than a board, a filter or a marketing page? */
export function isPostingUrl(url: string): boolean {
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return false;
  }
  if (!/^https?:$/.test(u.protocol)) return false;
  return POSTING_SHAPES.some((shape) => shape.test(u.href));
}

/**
 * The site a link belongs to, ignoring the subdomain: a SmartRecruiters board at
 * careers.smartrecruiters.com links its postings on jobs.smartrecruiters.com, and that is still
 * the same board — while another company's site is not.
 */
function site(hostname: string): string {
  return hostname.toLowerCase().split(".").slice(-2).join(".");
}

/**
 * The postings linked from a board page: absolute, same site, deduped, capped.
 *
 * The cap is the point. One level down, a handful per board — enough to reach the listings a
 * person would have clicked, far short of crawling a company's entire careers site.
 */
export function postingLinksFrom(pageUrl: string, hrefs: string[], limit = 8): string[] {
  let base: URL;
  try {
    base = new URL(pageUrl);
  } catch {
    return [];
  }
  const out: string[] = [];
  const seen = new Set<string>([base.href.replace(/[?#].*$/, "")]);
  for (const href of hrefs) {
    if (out.length >= limit) break;
    let u: URL;
    try {
      u = new URL(href, base);
    } catch {
      continue;
    }
    if (site(u.hostname) !== site(base.hostname)) continue;
    const clean = `${u.origin}${u.pathname}`;
    if (seen.has(clean)) continue;
    if (!isPostingUrl(clean)) continue;
    seen.add(clean);
    out.push(clean);
  }
  return out;
}
