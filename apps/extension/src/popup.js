// Popup logic: read the current tab's job (via the injected extractor), POST it to Fadi's
// capture endpoint using the user's Fadi session, and offer a first-pass application autofill.

const DEFAULT_BASE = "http://localhost:3000";
const statusEl = document.getElementById("status");
const baseInput = document.getElementById("base");

function setStatus(msg, kind) {
  statusEl.textContent = msg;
  statusEl.className = kind || "";
}

async function getBase() {
  const { fadiBase } = await chrome.storage.sync.get("fadiBase");
  return (fadiBase || DEFAULT_BASE).replace(/\/$/, "");
}

async function getToken() {
  const { fadiToken } = await chrome.storage.sync.get("fadiToken");
  return fadiToken || "";
}

// Headers for every Fadi call. The bearer token is how the extension authenticates — it can't
// send Fadi's SameSite session cookie from its own origin. credentials:"include" is kept as a
// fallback for the same-origin/dev case.
async function authHeaders(json) {
  const h = {};
  if (json) h["Content-Type"] = "application/json";
  const token = await getToken();
  if (token) h["Authorization"] = `Bearer ${token}`;
  return h;
}

const tokenInput = document.getElementById("token");
const connState = document.getElementById("connstate");

function renderConnState(token) {
  if (token) {
    connState.textContent = "Connected to Fadi ✓";
    connState.style.color = "#0f766e";
  } else {
    connState.textContent = "Not connected — paste a connection code below.";
    connState.style.color = "#777";
  }
}

const autoCaptureInput = document.getElementById("autocapture");

chrome.storage.sync.get(["fadiBase", "fadiToken", "fadiAutoCapture"]).then(({ fadiBase, fadiToken, fadiAutoCapture }) => {
  baseInput.value = fadiBase || DEFAULT_BASE;
  renderConnState(fadiToken);
  autoCaptureInput.checked = fadiAutoCapture !== false; // default on
});
autoCaptureInput.addEventListener("change", () =>
  chrome.storage.sync.set({ fadiAutoCapture: autoCaptureInput.checked }),
);
baseInput.addEventListener("change", () =>
  chrome.storage.sync.set({ fadiBase: baseInput.value.trim() || DEFAULT_BASE }),
);

// Open the Fadi connect page (user copies their code there).
document.getElementById("getcode").addEventListener("click", async () => {
  const base = await getBase();
  chrome.tabs.create({ url: `${base}/extension/connect` });
});

// Save the pasted connection code.
document.getElementById("connect").addEventListener("click", async () => {
  const token = (tokenInput.value || "").trim();
  if (!token) {
    setStatus("Paste your connection code first (click ‘Get code’).", "err");
    return;
  }
  await chrome.storage.sync.set({ fadiToken: token });
  tokenInput.value = "";
  renderConnState(token);
  setStatus("Connected to Fadi.", "ok");
});

async function activeTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

/** Run a function in the page and return its result. */
async function runInPage(func, args = []) {
  const tab = await activeTab();
  const [res] = await chrome.scripting.executeScript({ target: { tabId: tab.id }, func, args });
  return res && res.result;
}

// --- Scrape ALL jobs on this page --------------------------------------------
// The core "search the internet like a human" action: reads every job card on a portal
// search-results page (in the user's own logged-in session, so no Cloudflare wall) and
// sends the batch to Fadi. Never invents — it only forwards listings that are on-screen.
document.getElementById("scrapeall").addEventListener("click", async () => {
  setStatus("Scanning this page for jobs…");
  try {
    await chrome.scripting.executeScript({
      target: { tabId: (await activeTab()).id },
      files: ["src/extract.js"],
    });
    const result = await runInPage(() => fadiExtractJobList());
    const jobs = (result && result.jobs) || [];
    const pageText = (result && result.pageText) || "";
    if (jobs.length === 0 && !pageText) {
      setStatus("No job list detected here. Open a search-results page (e.g. LinkedIn/Indeed jobs).", "err");
      return;
    }
    // If the selectors matched, send the list; otherwise send the page text and let Fadi's
    // AI read the jobs off it (self-healing when a site changes its markup).
    setStatus(jobs.length ? `Sending ${jobs.length} job(s) to Fadi…` : "Asking Fadi's AI to read this page…");
    const base = await getBase();
    let source = "job board";
    try {
      source = new URL((await activeTab()).url).hostname.replace(/^www\./, "");
    } catch {
      /* keep default */
    }
    const res = await fetch(`${base}/api/extension/capture-batch`, {
      method: "POST",
      headers: await authHeaders(true),
      credentials: "include",
      body: JSON.stringify({ jobs: jobs.slice(0, 60), pageText, source }),
    });
    if (res.status === 401) {
      setStatus("Sign in to Fadi first, then try again.", "err");
      return;
    }
    const data = await res.json().catch(() => ({}));
    if (data.ok) {
      const how = data.usedAi ? " (read by Fadi AI)" : "";
      setStatus(data.saved > 0 ? `Scraped ${data.saved} job(s) into Fadi${how}.` : "No jobs found on this page.", data.saved > 0 ? "ok" : "err");
    } else {
      setStatus(`Failed: ${data.error || res.status}`, "err");
    }
  } catch (e) {
    setStatus(`Error: ${e.message}`, "err");
  }
});

// --- Save this job -----------------------------------------------------------
document.getElementById("save").addEventListener("click", async () => {
  setStatus("Reading the job…");
  try {
    // extract.js defines fadiExtractJob on the page's window when injected.
    await chrome.scripting.executeScript({
      target: { tabId: (await activeTab()).id },
      files: ["src/extract.js"],
    });
    const job = await runInPage(() => fadiExtractJob());
    if (!job || !job.title || !job.company) {
      setStatus("Couldn't detect a job on this page.", "err");
      return;
    }
    setStatus("Saving to Fadi…");
    const base = await getBase();
    const res = await fetch(`${base}/api/extension/capture`, {
      method: "POST",
      headers: await authHeaders(true),
      credentials: "include",
      body: JSON.stringify(job),
    });
    if (res.status === 401) {
      setStatus("Sign in to Fadi first, then try again.", "err");
      return;
    }
    const data = await res.json().catch(() => ({}));
    setStatus(data.ok ? `Saved: ${job.title}` : `Failed: ${data.error || res.status}`, data.ok ? "ok" : "err");
  } catch (e) {
    setStatus(`Error: ${e.message}`, "err");
  }
});

// --- Autofill (first pass) ---------------------------------------------------
// Fills obviously-named fields from the user's Fadi profile. A real version pulls the
// profile from Fadi; this MVP fills from locally-cached basics and NEVER submits.
document.getElementById("autofill").addEventListener("click", async () => {
  setStatus("Autofilling…");
  try {
    // Pull the user's VERIFIED basics from Fadi (never invented) for the fill.
    const base = await getBase();
    const pres = await fetch(`${base}/api/extension/profile`, { credentials: "include", headers: await authHeaders(false) });
    if (pres.status === 401) {
      setStatus("Sign in to Fadi first, then try again.", "err");
      return;
    }
    const pdata = await pres.json().catch(() => ({}));
    const profile = (pdata && pdata.profile) || {};
    const filled = await runInPage((p) => {
      const set = (selectors, value) => {
        if (!value) return 0;
        for (const sel of selectors) {
          const el = document.querySelector(sel);
          if (el) {
            el.value = value;
            el.dispatchEvent(new Event("input", { bubbles: true }));
            return 1;
          }
        }
        return 0;
      };
      let n = 0;
      n += set(['input[name*="name" i]', "#name", "#fullName"], p.name);
      n += set(['input[type="email"]', 'input[name*="email" i]'], p.email);
      n += set(['input[type="tel"]', 'input[name*="phone" i]'], p.phone);
      n += set(['input[name*="location" i]', 'input[name*="city" i]'], p.location);
      return n;
    }, [profile]);
    setStatus(
      filled > 0 ? `Filled ${filled} field(s) — review before submitting.` : "No obvious fields found.",
      filled > 0 ? "ok" : "err",
    );
  } catch (e) {
    setStatus(`Error: ${e.message}`, "err");
  }
});

// --- Clip selection → Evidence -----------------------------------------------
document.getElementById("evidence").addEventListener("click", async () => {
  setStatus("Reading selection…");
  try {
    const sel = await runInPage(() => (window.getSelection ? window.getSelection().toString().trim() : ""));
    const detail = (sel || "").trim();
    if (!detail) {
      setStatus("Select some text on the page first.", "err");
      return;
    }
    const title = detail.split("\n")[0].slice(0, 120) || document.title;
    const base = await getBase();
    const res = await fetch(`${base}/api/extension/evidence`, {
      method: "POST",
      headers: await authHeaders(true),
      credentials: "include",
      body: JSON.stringify({ title, detail: detail.slice(0, 4000) }),
    });
    if (res.status === 401) return setStatus("Sign in to Fadi first.", "err");
    const data = await res.json().catch(() => ({}));
    setStatus(data.ok ? "Clipped to Evidence." : `Failed: ${data.error || res.status}`, data.ok ? "ok" : "err");
  } catch (e) {
    setStatus(`Error: ${e.message}`, "err");
  }
});

// --- Add referral from this profile ------------------------------------------
document.getElementById("contact").addEventListener("click", async () => {
  setStatus("Reading profile…");
  try {
    await chrome.scripting.executeScript({ target: { tabId: (await activeTab()).id }, files: ["src/extract.js"] });
    const p = await runInPage(() => fadiExtractProfile());
    if (!p || !p.company) {
      setStatus("Couldn't read a company from this profile. Open a LinkedIn profile.", "err");
      return;
    }
    const base = await getBase();
    const res = await fetch(`${base}/api/extension/contact`, {
      method: "POST",
      headers: await authHeaders(true),
      credentials: "include",
      body: JSON.stringify(p),
    });
    if (res.status === 401) return setStatus("Sign in to Fadi first.", "err");
    const data = await res.json().catch(() => ({}));
    setStatus(data.ok ? `Added referral: ${p.contactName || p.company}` : `Failed: ${data.error || res.status}`, data.ok ? "ok" : "err");
  } catch (e) {
    setStatus(`Error: ${e.message}`, "err");
  }
});
