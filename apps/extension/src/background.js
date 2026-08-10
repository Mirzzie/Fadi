// Service worker. Two jobs:
//  1. Housekeeping on install.
//  2. The "live scrape" bridge target: when a Fadi page (via bridge.js) asks to search the
//     live web, this opens the job portal(s) in a background tab IN THE USER'S OWN SESSION,
//     scrapes the rendered results with the same extractor the popup uses, and returns them.
//     Because it's the user's real, logged-in browser, it reads results a server can't (past
//     Cloudflare / login walls). Doctrine: it only forwards listings actually on the page.

chrome.runtime.onInstalled.addListener(() => {
  // eslint-disable-next-line no-console
  console.log("Fadi extension installed.");
});

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Resolve once the tab finishes loading (or after a hard timeout). */
function waitForComplete(tabId, timeoutMs) {
  return new Promise((resolve) => {
    let settled = false;
    const done = () => {
      if (settled) return;
      settled = true;
      chrome.tabs.onUpdated.removeListener(listener);
      resolve();
    };
    const listener = (id, info) => {
      if (id === tabId && info.status === "complete") done();
    };
    chrome.tabs.onUpdated.addListener(listener);
    // In case it already completed before we attached.
    chrome.tabs.get(tabId, (t) => {
      if (!chrome.runtime.lastError && t && t.status === "complete") done();
    });
    setTimeout(done, timeoutMs);
  });
}

/** Build portal search URLs from a query. Portal knowledge lives here, not in the web app. */
function buildUrls(query) {
  const kw = (query.keywords || "").trim() || "jobs";
  const loc = (query.location || "").trim();
  const enc = encodeURIComponent;
  const portals = query.portals && query.portals.length ? query.portals : ["linkedin", "indeed"];
  const urls = [];
  if (portals.includes("linkedin")) {
    let u = `https://www.linkedin.com/jobs/search/?keywords=${enc(kw)}`;
    if (loc) u += `&location=${enc(loc)}`;
    if (query.remote) u += "&f_WT=2"; // LinkedIn remote work-type filter
    urls.push(u);
  }
  if (portals.includes("indeed")) {
    let u = `https://www.indeed.com/jobs?q=${enc(kw)}`;
    if (loc) u += `&l=${enc(loc)}`;
    urls.push(u);
  }
  return urls;
}

/** Open one URL in a background tab, let it render, scrape job cards, close it. */
async function scrapeUrl(url) {
  const tab = await chrome.tabs.create({ url, active: false });
  const tabId = tab.id;
  try {
    await waitForComplete(tabId, 20000);
    await sleep(2800); // let JS-rendered / lazy job cards paint
    await chrome.scripting.executeScript({ target: { tabId }, files: ["src/extract.js"] });
    // Scroll + accumulate (handles LinkedIn's virtualized list) rather than a single pass.
    const [res] = await chrome.scripting.executeScript({
      target: { tabId },
      func: () => fadiScrollAndCollect(50),
    });
    const out = res && res.result;
    return (out && out.jobs) || [];
  } catch {
    return [];
  } finally {
    chrome.tabs.remove(tabId).catch(() => {});
  }
}

/** Scrape every portal URL for a query and return a deduped job list. */
async function handleScrape(query) {
  const urls = buildUrls(query || {});
  const results = await Promise.all(urls.map((u) => scrapeUrl(u)));
  const seen = new Set();
  const jobs = [];
  for (const list of results) {
    for (const j of list) {
      if (!j || !j.title) continue;
      const key = `${j.title}|${j.company || ""}`.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      jobs.push(j);
      if (jobs.length >= 60) break;
    }
  }
  return jobs;
}

// Messages from the in-page bridge (content script on the Fadi origin).
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg && msg.type === "fadi_scrape") {
    handleScrape(msg.query)
      .then((jobs) => sendResponse({ ok: true, jobs }))
      .catch((e) => sendResponse({ ok: false, error: String((e && e.message) || e) }));
    return true; // keep the message channel open for the async response
  }
  return undefined;
});
