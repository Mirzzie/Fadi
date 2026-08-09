// Service worker. Minimal for the MVP — the popup does the capture/autofill directly.
// Future: context-menu "Save to Fadi", fetching the live profile for autofill, and an
// on-page overlay (fit score / "tailor résumé to this JD").
chrome.runtime.onInstalled.addListener(() => {
  // eslint-disable-next-line no-console
  console.log("Fadi extension installed.");
});
