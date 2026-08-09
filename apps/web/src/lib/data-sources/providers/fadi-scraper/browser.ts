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
