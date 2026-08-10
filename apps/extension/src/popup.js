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

chrome.storage.sync.get("fadiBase").then(({ fadiBase }) => {
  baseInput.value = fadiBase || DEFAULT_BASE;
});
baseInput.addEventListener("change", () =>
  chrome.storage.sync.set({ fadiBase: baseInput.value.trim() || DEFAULT_BASE }),
);

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
      headers: { "Content-Type": "application/json" },
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
    const pres = await fetch(`${base}/api/extension/profile`, { credentials: "include" });
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
