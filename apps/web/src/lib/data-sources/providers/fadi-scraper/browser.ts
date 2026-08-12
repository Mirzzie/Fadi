import "server-only";

import type { SignalQuery } from "../../types";
import type { ScrapedRecord, SiteRecipe } from "./recipes";

// The browser engine: drives a real Chromium (Playwright) the way a human would — realistic
// UA/viewport, jittered pauses, scrolling, pagination — then reads each listing. Loaded ONLY
// when the scraper is enabled (dynamic import in the provider), so Playwright never bundles
// into the app by default.
//
// Playwright is an OPTIONAL runtime dependency. The indirect specifier keeps TypeScript from
// requiring it at build time; if it (or its browser binary) isn't installed, we no-op cleanly.

const HUMAN_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";

const jitter = (min: number, max: number) => Math.floor(min + Math.random() * (max - min));

export async function scrapeRecipe(
  recipe: SiteRecipe,
  query: SignalQuery,
  limit: number,
): Promise<ScrapedRecord[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let pw: any;
  try {
    const specifier = "playwright";
    pw = await import(/* webpackIgnore: true */ specifier);
  } catch {
    return []; // Playwright not installed — the scraper stays dormant.
  }

  const selectors = recipe.selectors;
  if (!selectors) return []; // selector-mode only; AI mode uses scrapePageText instead.

  const browser = await pw.chromium.launch({ headless: true });
  try {
    const context = await browser.newContext({
      userAgent: HUMAN_UA,
      viewport: { width: 1280, height: 900 },
      locale: "en-US",
    });
    const page = await context.newPage();
    const records: ScrapedRecord[] = [];

    for (let p = 1; p <= recipe.maxPages && records.length < limit; p++) {
      await page.goto(recipe.searchUrl(query, p), {
        waitUntil: "domcontentloaded",
        timeout: 20_000,
      });
      await page.waitForTimeout(jitter(500, 1400)); // human pause
      await page.mouse.wheel(0, jitter(800, 1800)); // scroll to load lazily
      await page.waitForTimeout(jitter(300, 900));

      const cards = await page.$$(selectors.card);
      for (const card of cards) {
        if (records.length >= limit) break;
        const text = async (sel?: string) =>
          sel
            ? await card.$eval(sel, (el: Element) => el.textContent?.trim() ?? "").catch(() => undefined)
            : undefined;
        const title = await text(selectors.title);
        const company = await text(selectors.company);
        const location = await text(selectors.location);
        const url = await card
          .$eval(selectors.link, (el: Element) => el.getAttribute("href") ?? undefined)
          .catch(() => undefined);
        if (title && company) records.push({ title, company, location, url });
      }
    }
    return records.slice(0, limit);
  } finally {
    await browser.close();
  }
}

/**
 * Rendered-DOM capture: drive a real Chromium (which gets past the UA/JS gates that block a
 * plain fetch — verified on Indeed & irishjobs), then extract jobs from the LIVE DOM with a
 * resilient, anchor-first heuristic (job-detail links + JSON-LD). No LLM, no per-site selector
 * config — the same approach the browser extension uses, run server-side. This is Fadi's own
 * scraper for the walled aggregators.
 */
export async function scrapeRendered(
  recipe: SiteRecipe,
  query: SignalQuery,
  limit: number,
): Promise<ScrapedRecord[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let pw: any;
  try {
    const specifier = "playwright";
    pw = await import(/* webpackIgnore: true */ specifier);
  } catch {
    return [];
  }

  const browser = await pw.chromium.launch({ headless: true });
  try {
    const context = await browser.newContext({
      userAgent: HUMAN_UA,
      viewport: { width: 1280, height: 900 },
      locale: "en-IE",
    });
    const page = await context.newPage();
    const records: ScrapedRecord[] = [];

    for (let p = 1; p <= recipe.maxPages && records.length < limit; p++) {
      await page.goto(recipe.searchUrl(query, p), { waitUntil: "domcontentloaded", timeout: 25_000 });
      await page.waitForTimeout(jitter(2500, 3800)); // let JS render + lazy cards paint
      await page.evaluate(() => window.scrollTo(0, 3000));
      await page.waitForTimeout(jitter(800, 1500));

      // Runs IN the page: pull jobs from job-detail anchors + JSON-LD. Self-contained.
      const jobs: ScrapedRecord[] = await page.evaluate(() => {
        const clean = (s: string | null | undefined) => (s ? s.replace(/\s+/g, " ").trim() : "");
        const strip = (t: string) => clean(t).replace(/^full details of\s*/i, "");
        const out: { title: string; company: string; location?: string; url?: string }[] = [];
        const seen = new Set<string>();
        const push = (title: string, company: string, location: string, url: string) => {
          const t = strip(title);
          if (!t || t.length < 4 || /view similar|sign in|skip to|create.*alert|cookie/i.test(t)) return;
          const k = t.toLowerCase();
          if (seen.has(k)) return;
          seen.add(k);
          out.push({
            title: t.slice(0, 300),
            company: clean(company).slice(0, 200),
            location: clean(location).slice(0, 200) || undefined,
            url: url || undefined,
          });
        };
        // Anchors to a job detail — the stable part across redesigns.
        document
          .querySelectorAll(
            'a[href*="/viewjob?jk="], a.jcs-JobTitle, h2.jobTitle a, a[data-jk], a[href*="/rc/clk"], a[href*="/job/"]',
          )
          .forEach((a) => {
            const el = a as HTMLElement;
            const card = el.closest(
              '.job_seen_beacon,.cardOutline,[data-testid="slider_item"],td.resultContent,li,article,div',
            );
            const company = (card?.querySelector(
              '[data-testid="company-name"],.companyName,[data-company-name],[class*="compan" i],[class*="employer" i]',
            ) as HTMLElement | null)?.textContent;
            const location = (card?.querySelector(
              '[data-testid="text-location"],.companyLocation,[class*="location" i]',
            ) as HTMLElement | null)?.textContent;
            push(el.getAttribute("aria-label") || el.textContent || "", company ?? "", location ?? "", (el as HTMLAnchorElement).href);
          });
        // Structured data, when the site provides it.
        for (const s of document.querySelectorAll('script[type="application/ld+json"]')) {
          try {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const d: any = JSON.parse(s.textContent || "{}");
            const list = (d.itemListElement || []).map((x: { item?: unknown }) => x?.item ?? x);
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const arr: any[] = Array.isArray(d) ? d : [d, ...(d["@graph"] || []), ...list];
            for (const j of arr) {
              const ty = j?.["@type"];
              if (j && (ty === "JobPosting" || (Array.isArray(ty) && ty.includes("JobPosting")))) {
                const org = typeof j.hiringOrganization === "string" ? j.hiringOrganization : j.hiringOrganization?.name;
                push(j.title ?? "", org ?? "", "", j.url ?? "");
              }
            }
          } catch {
            /* ignore malformed */
          }
        }
        return out.slice(0, 40);
      });

      for (const j of jobs) {
        if (records.length >= limit) break;
        // Company is best-effort from the card; keep the job even if it's blank (title + url are
        // the real signal), letting the pipeline fill/verify later.
        records.push({ title: j.title, company: j.company || recipe.name, location: j.location, url: j.url });
      }
    }
    return records.slice(0, limit);
  } finally {
    await browser.close();
  }
}

/**
 * AI-mode capture: navigate like a human and return the rendered page's visible text, for an
 * LLM to extract from (self-healing — no per-site selectors). Concatenates the first few
 * result pages. Returns "" if Playwright is unavailable.
 */
export async function scrapePageText(recipe: SiteRecipe, query: SignalQuery): Promise<string> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let pw: any;
  try {
    const specifier = "playwright";
    pw = await import(/* webpackIgnore: true */ specifier);
  } catch {
    return "";
  }

  const browser = await pw.chromium.launch({ headless: true });
  try {
    const context = await browser.newContext({
      userAgent: HUMAN_UA,
      viewport: { width: 1280, height: 900 },
      locale: "en-US",
    });
    const page = await context.newPage();
    const chunks: string[] = [];
    for (let p = 1; p <= recipe.maxPages; p++) {
      await page.goto(recipe.searchUrl(query, p), { waitUntil: "domcontentloaded", timeout: 20_000 });
      await page.waitForTimeout(jitter(500, 1400));
      await page.mouse.wheel(0, jitter(800, 1800));
      await page.waitForTimeout(jitter(300, 900));
      const body = await page.evaluate(() => document.body?.innerText ?? "").catch(() => "");
      if (body) chunks.push(body);
    }
    return chunks.join("\n\n").slice(0, 40_000);
  } finally {
    await browser.close();
  }
}
