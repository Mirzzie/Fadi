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
    ld.title || meta("og:title") || text(document.querySelector("h1")) || document.title || "";
  const company =
    orgOf(ld.hiringOrganization) ||
    meta("og:site_name") ||
    text(document.querySelector('[class*="company" i], [data-company]')) ||
    "";
  const location =
    locOf(ld.jobLocation) || text(document.querySelector('[class*="location" i]')) || "";
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
