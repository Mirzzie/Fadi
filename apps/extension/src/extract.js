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
// Cloudflare block). Returns [{ title, company, location, url }]. This is the "scrape the
// internet, like a human" leg — the human's real browser is doing it.
function fadiExtractJobList() {
  const t = (el) => (el && el.textContent ? el.textContent.replace(/\s+/g, " ").trim() : "");
  const cards = document.querySelectorAll(
    [
      ".job-card-container",
      "li.jobs-search-results__list-item",
      ".jobs-search-results__list-item",
      ".scaffold-layout__list-item",
      ".job_seen_beacon",
      "[data-job-id]",
      "[data-jk]",
    ].join(","),
  );
  const out = [];
  const seen = new Set();
  for (const c of cards) {
    const title = t(
      c.querySelector(
        '.job-card-list__title, .job-card-container__link span, a[class*="title" i], .jobTitle, h2 a, [data-testid="job-title"]',
      ),
    );
    const company = t(
      c.querySelector(
        '.job-card-container__company-name, .artdeco-entity-lockup__subtitle, .companyName, [data-testid="company-name"], [class*="company" i]',
      ),
    );
    const location = t(
      c.querySelector('.job-card-container__metadata-item, .companyLocation, [class*="location" i]'),
    );
    const a =
      c.querySelector('a[href*="/jobs/view/"], a[href*="viewjob"], a[href*="/jobs/"]') ||
      c.querySelector("a[href]");
    const url = a ? a.href : undefined;
    if (!title || !company) continue;
    const key = `${title}|${company}`.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ title: title.slice(0, 300), company: company.slice(0, 200), location: location || undefined, url });
    if (out.length >= 50) break;
  }
  return out;
}
