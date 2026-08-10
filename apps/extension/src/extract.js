// Runs IN the job page (via chrome.scripting.executeScript) to read the listing the way a
// person would. Heuristic + resilient: prefers JSON-LD JobPosting, then Open Graph / common
// selectors, then sensible fallbacks. Returns { title, company, location, description, url }.
// Kept dependency-free so it can be injected as a function.
function fadiExtractJob() {
  const text = (el) => (el && el.textContent ? el.textContent.trim() : "");
  const meta = (name) => {
    const el =
      document.querySelector(`meta[property="${name}"]`) ||
      document.querySelector(`meta[name="${name}"]`);
    return el ? el.getAttribute("content") || "" : "";
  };
  // First non-empty match across a list of candidate selectors (portal → generic).
  const pick = (sels) => {
    for (const s of sels) {
      const v = text(document.querySelector(s));
      if (v) return v;
    }
    return "";
  };

  // 1) Structured data — the most reliable source when present.
  let ld = {};
  for (const s of document.querySelectorAll('script[type="application/ld+json"]')) {
    try {
      const data = JSON.parse(s.textContent || "{}");
      const arr = Array.isArray(data) ? data : [data, ...(data["@graph"] || [])];
      const jp = arr.find((d) => d && (d["@type"] === "JobPosting" || d.title));
      if (jp) {
        ld = jp;
        break;
      }
    } catch {
      /* ignore malformed JSON-LD */
    }
  }

  const orgOf = (o) => (typeof o === "string" ? o : o && o.name ? o.name : "");
  const locOf = (o) => {
    if (!o) return "";
    const a = (Array.isArray(o) ? o[0] : o).address || {};
    return [a.addressLocality, a.addressRegion, a.addressCountry].filter(Boolean).join(", ");
  };

  const title =
    ld.title ||
    pick([
      ".job-details-jobs-unified-top-card__job-title",
      ".jobs-unified-top-card__job-title",
      ".t-24.job-details-jobs-unified-top-card__job-title",
      "h1.top-card-layout__title",
      '[data-testid="jobsearch-JobInfoHeader-title"]',
      "h2.jobsearch-JobInfoHeader-title",
      "h1",
    ]) ||
    meta("og:title") ||
    document.title ||
    "";
  const company =
    orgOf(ld.hiringOrganization) ||
    pick([
      ".job-details-jobs-unified-top-card__company-name",
      ".jobs-unified-top-card__company-name",
      ".topcard__org-name-link",
      ".topcard__flavor",
      '[data-testid="inlineHeader-companyName"]',
      '[data-company-name]',
      '[class*="company" i]',
    ]) ||
    meta("og:site_name") ||
    "";
  const location =
    locOf(ld.jobLocation) ||
    pick([
      ".job-details-jobs-unified-top-card__primary-description-container",
      ".jobs-unified-top-card__bullet",
      ".topcard__flavor--bullet",
      '[data-testid="inlineHeader-companyLocation"]',
      '[class*="location" i]',
    ]) ||
    "";
  const description = (
    ld.description ||
    meta("og:description") ||
    text(document.querySelector("main")) ||
    document.body.innerText ||
    ""
  )
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 8000);

  return {
    title: (title || "").trim().slice(0, 300),
    company: (company || "").trim().slice(0, 200),
    location: (location || "").trim().slice(0, 200) || undefined,
    description: description || undefined,
    url: window.location.href,
  };
}

// Reads a LinkedIn (or generic) profile page for a referral target: { company, contactName,
// contactRole }. Runs in the user's own session, so walled profiles are readable.
function fadiExtractProfile() {
  const t = (el) => (el && el.textContent ? el.textContent.trim() : "");
  const name = t(document.querySelector("h1")) || document.title.replace(/\s*[|\-–].*$/, "").trim();
  const role =
    t(document.querySelector('.text-body-medium, [class*="headline" i], [data-generated-suggestion-target]')) ||
    "";
  // Current company: LinkedIn shows it in the experience/top-card; fall back to og:site_name.
  const company =
    t(document.querySelector('[aria-label*="Current company" i], [class*="company" i]')) ||
    (document.querySelector('meta[property="og:title"]')?.content || "").split(" - ")[1] ||
    "";
  return {
    contactName: (name || "").slice(0, 200),
    contactRole: (role || "").slice(0, 300),
    company: (company || "").trim().slice(0, 200),
  };
}

// Auto-scrape ALL job cards on a portal SEARCH page (LinkedIn/Indeed/etc.). Because this
// runs in the user's own logged-in session, it reads results a server scraper can't (no
// Cloudflare block). This is the "scrape the internet, like a human" leg — the human's
// real browser is doing it.
//
// Returns { jobs: [{title, company, location, url}], pageText }. Selectors rot as sites
// change their markup (2026 reality), so this is defensive: it works off the job-detail
// ANCHORS first (stable — every card links to /jobs/view/…), dedupes LinkedIn's doubled
// title text, and always also returns cleaned page text so Fadi can AI-extract as a
// self-healing fallback when the DOM heuristics miss.
function fadiExtractJobList() {
  const clean = (s) => (s || "").replace(/\s+/g, " ").trim();
  // LinkedIn renders the title twice (visible + a screen-reader "… with verification" copy),
  // so textContent doubles it. Strip the a11y suffix, then collapse an exact double.
  const dedupe = (s) => {
    let v = clean(s).replace(/\s*with verification\s*$/i, "");
    const n = v.length;
    if (n > 0 && n % 2 === 0 && v.slice(0, n / 2).trim() === v.slice(n / 2).trim()) {
      v = v.slice(0, n / 2).trim();
    }
    return v;
  };

  const CARD_SEL = [
    "[data-occludable-job-id]",
    "li.scaffold-layout__list-item",
    ".scaffold-layout__list-item",
    ".job-card-container",
    "li.jobs-search-results__list-item",
    ".jobs-search-results__list-item",
    ".job_seen_beacon",
    "[data-job-id]",
    "[data-jk]",
    "div.base-card",
  ].join(",");
  const closestCard = (el) => el.closest(CARD_SEL) || el.parentElement;
  const titleFromAnchor = (a) => {
    const vis = a.querySelector('[aria-hidden="true"]');
    let t = vis ? clean(vis.textContent) : "";
    if (!t) t = clean(a.getAttribute("aria-label"));
    if (!t) t = clean(a.textContent);
    return dedupe(t);
  };
  const pickText = (card, sel) => clean((card && card.querySelector(sel) || {}).textContent);
  const companyOf = (card) =>
    pickText(
      card,
      '.artdeco-entity-lockup__subtitle, .job-card-container__company-name, .job-card-container__primary-description, [data-testid="company-name"], .companyName, [class*="company" i]',
    );
  const locationOf = (card) =>
    pickText(
      card,
      '.artdeco-entity-lockup__caption, .job-card-container__metadata-item, [data-testid="text-location"], .companyLocation, [class*="location" i]',
    );

  const out = [];
  const seen = new Set();
  const push = (title, company, location, url) => {
    title = clean(title).slice(0, 300);
    company = clean(company).slice(0, 200);
    if (!title) return;
    const key = `${title}|${company}`.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    out.push({ title, company: company || undefined, location: location || undefined, url });
  };

  // Strategy A — anchors to a job detail page. Stable across redesigns; every card has one.
  const anchors = document.querySelectorAll(
    'a[href*="/jobs/view/"], a[href*="currentJobId="], a[href*="viewjob"], a.jcs-JobTitle, h2.jobTitle a, a[data-jk]',
  );
  for (const a of anchors) {
    if (out.length >= 50) break;
    const title = titleFromAnchor(a);
    if (!title) continue;
    const card = closestCard(a);
    push(title, companyOf(card), locationOf(card), a.href);
  }

  // Strategy B — card-based fallback if no anchors matched.
  if (out.length === 0) {
    for (const card of document.querySelectorAll(CARD_SEL)) {
      if (out.length >= 50) break;
      const a = card.querySelector('a[href*="/jobs/view/"], a[href*="viewjob"], a[href]');
      const titleEl = card.querySelector(
        '.job-card-list__title, .artdeco-entity-lockup__title, .jobTitle, h2 a, [data-testid="job-title"]',
      );
      const title = titleEl ? dedupe(titleEl.textContent) : a ? titleFromAnchor(a) : "";
      push(title, companyOf(card), locationOf(card), a ? a.href : undefined);
    }
  }

  // Always return cleaned page text so the server can AI-extract if the heuristics miss.
  const main = document.querySelector("main") || document.body;
  const pageText = clean(main.innerText || "").slice(0, 12000);
  return { jobs: out, pageText };
}

// Scroll a search page to pull in lazy-loaded results, ACCUMULATING as we go. LinkedIn
// virtualizes its list (off-screen cards are emptied from the DOM), so a scroll-then-extract
// misses rows — we extract every step and merge by title|company. Returns { jobs, pageText }.
// Used by the background worker's live-search bridge. Async: executeScript awaits the promise.
async function fadiScrollAndCollect(maxCards) {
  const cap = maxCards || 50;
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const container =
    document.querySelector(".jobs-search-results-list") ||
    document.querySelector(".scaffold-layout__list") ||
    document.querySelector(".jobs-search__results-list") ||
    null;
  const merged = new Map();
  let lastText = "";
  const absorb = () => {
    const r = fadiExtractJobList();
    if (r.pageText && r.pageText.length > lastText.length) lastText = r.pageText;
    for (const j of r.jobs) {
      const key = `${j.title}|${j.company || ""}`.toLowerCase();
      if (!merged.has(key)) merged.set(key, j);
    }
  };
  absorb();
  let stable = 0;
  for (let i = 0; i < 15 && merged.size < cap; i++) {
    const before = merged.size;
    if (container) container.scrollTo(0, container.scrollHeight);
    else window.scrollTo(0, document.body.scrollHeight);
    await sleep(1100);
    absorb();
    if (merged.size === before) {
      stable += 1;
      if (stable >= 2) break; // two quiet rounds → the list is exhausted
    } else {
      stable = 0;
    }
  }
  return { jobs: Array.from(merged.values()).slice(0, cap), pageText: lastText };
}
