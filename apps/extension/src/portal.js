// Auto-capture: runs on job portals (LinkedIn / Indeed) and sends the jobs it finds to Fadi
// WITHOUT the user clicking anything. It uses the extractor from extract.js (injected in the
// same content-script world). Guardrails so it's helpful, not spammy:
//   - only when auto-capture is enabled (popup toggle, default on) AND a connection code exists
//   - only on pages that actually have a job list
//   - once per URL (deduped in sessionStorage), and re-checks on SPA navigation
//   - a small toast reports what it captured; it never submits applications or changes the page

(function () {
  let lastUrl = "";
  let busy = false;

  function toast(message, kind) {
    let el = document.getElementById("fadi-autocapture-toast");
    if (!el) {
      el = document.createElement("div");
      el.id = "fadi-autocapture-toast";
      el.style.cssText = [
        "position:fixed",
        "z-index:2147483647",
        "right:16px",
        "bottom:16px",
        "max-width:280px",
        "padding:10px 14px",
        "border-radius:10px",
        "font:13px/1.4 system-ui,sans-serif",
        "color:#fff",
        "box-shadow:0 6px 24px rgba(0,0,0,.25)",
        "transition:opacity .3s",
        "pointer-events:none",
      ].join(";");
      document.body.appendChild(el);
    }
    el.style.background = kind === "err" ? "#be123c" : "#0f766e";
    el.textContent = message;
    el.style.opacity = "1";
    clearTimeout(el._t);
    el._t = setTimeout(() => {
      el.style.opacity = "0";
    }, 4000);
  }

  async function maybeCapture() {
    if (busy) return;
    const url = location.href;
    if (url === lastUrl) return;

    const { fadiAutoCapture, fadiToken } = await chrome.storage.sync.get(["fadiAutoCapture", "fadiToken"]);
    if (fadiAutoCapture === false) return; // default on when undefined
    if (!fadiToken) return; // not connected — stay silent, the popup handles connecting

    // Only fire once per URL per tab session.
    const seenKey = `fadi-cap:${url}`;
    if (sessionStorage.getItem(seenKey)) return;

    // Is there actually a job list here yet? (extract.js is injected alongside this file.)
    const probe = typeof fadiExtractJobList === "function" ? fadiExtractJobList() : { jobs: [] };
    if (!probe.jobs || probe.jobs.length === 0) return;

    busy = true;
    lastUrl = url;
    sessionStorage.setItem(seenKey, "1");
    try {
      // Scroll + accumulate for a fuller list, then hand off to the background to persist.
      const collected =
        typeof fadiScrollAndCollect === "function" ? await fadiScrollAndCollect(50) : probe;
      const jobs = (collected && collected.jobs) || [];
      if (jobs.length === 0) return;
      const source = location.hostname.replace(/^www\./, "");
      const resp = await chrome.runtime.sendMessage({ type: "fadi_autocapture", jobs, source });
      if (resp && resp.ok) {
        toast(`Fadi captured ${resp.saved} job${resp.saved === 1 ? "" : "s"} from this page.`);
      } else if (resp && resp.error === "not_connected") {
        // shouldn't happen (token checked above) but be safe
      } else {
        toast("Fadi couldn't save these jobs.", "err");
      }
    } catch {
      /* never break the host page */
    } finally {
      busy = false;
    }
  }

  // Initial run after the page settles, then watch for SPA navigations + late-loading lists.
  setTimeout(maybeCapture, 3500);
  setInterval(maybeCapture, 4000);
})();
