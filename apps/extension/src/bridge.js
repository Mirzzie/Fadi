// Content script injected into the Fadi origin. It bridges the Fadi web page (which can't talk
// to the extension directly) and the extension's background service worker:
//   page  --window.postMessage-->  bridge.js  --chrome.runtime.sendMessage-->  background.js
// and the response flows back the same way. This is what lets a search in Fadi trigger a live
// scrape of a job portal in the user's own session.

(function () {
  const origin = window.location.origin;

  function announce() {
    window.postMessage({ __fadiRes: true, kind: "ready" }, origin);
  }

  // Tell the page we're here (once now, and again shortly in case the page listener
  // attaches after document_idle).
  announce();
  setTimeout(announce, 300);

  window.addEventListener("message", (e) => {
    if (e.source !== window) return;
    const d = e.data;
    if (!d || d.__fadiReq !== true) return;

    if (d.kind === "ping") {
      window.postMessage({ __fadiRes: true, kind: "ready", requestId: d.requestId }, origin);
      return;
    }

    if (d.kind === "scrape") {
      chrome.runtime.sendMessage({ type: "fadi_scrape", query: d.query }, (resp) => {
        const err = chrome.runtime.lastError ? chrome.runtime.lastError.message : undefined;
        window.postMessage(
          {
            __fadiRes: true,
            kind: "scrape-result",
            requestId: d.requestId,
            ok: Boolean(resp && resp.ok) && !err,
            jobs: (resp && resp.jobs) || [],
            error: err || (resp && resp.error),
          },
          origin,
        );
      });
    }
  });
})();
