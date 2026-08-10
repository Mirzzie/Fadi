# Fadi Browser Extension (MVP)

The third leg of Fadi's job discovery: where the **APIs** cover open boards and the **Fadi
scraper** covers the API-less long tail, the **extension** captures **login-walled sites**
(LinkedIn, Indeed, company ATS) using the user's own authenticated session — the legal,
human-in-the-loop path — plus **application autofill**.

## What it does (MVP)

- **Scrape all jobs on this page** — on a portal search-results page (LinkedIn, Indeed, …),
  reads **every** job card and sends the batch to `POST /api/extension/capture-batch`. Because
  it runs in the user's own logged-in session, it sees results a server scraper can't (no
  Cloudflare wall). Selectors rot, so it works off the stable job-detail anchors first and, if
  those miss, sends the page text for Fadi's AI to extract (self-healing). This is the
  "search the internet like a human" leg.
- **Save just this job** — reads the single job on the current page (JSON-LD `JobPosting` →
  Open Graph → fallbacks) and POSTs it to `POST /api/extension/capture`.
- **Autofill this application** — fills obviously-named fields (name/email/phone/location)
  from the user's verified Fadi profile and **never submits** (the user reviews).
- **Clip selection to Evidence** / **Add referral (LinkedIn)** — capture a win or a contact.

## Load it (Chrome/Edge/Brave, unpacked)

1. Run Fadi (`npm run dev`) and sign in.
2. `chrome://extensions` → enable **Developer mode** → **Load unpacked** → select this
   `apps/extension` folder.
3. **Connect it to your account** (once) — see below. Set the Fadi URL in the popup if it
   isn't `http://localhost:3000`.

## Connecting (auth)

A `chrome-extension://` popup can't send Fadi's `SameSite` session cookie cross-site, so the
extension authenticates with a **bearer connection code** instead:

1. In the popup, click **Get code** → opens `/extension/connect` in a Fadi tab.
2. Sign in if needed, **Copy code**, paste it into the popup, click **Connect**.
3. The popup stores the code and sends it as `Authorization: Bearer <code>` on every call.

The code is a signed (HMAC) 90-day token scoped to the user — **not** a session cookie and no
substitute for one. Server side, `getExtensionUser()` accepts either a real session cookie
(same-origin) or this bearer token. Re-open the connect page any time for a fresh code.

## Roadmap

- Fadi-search → extension bridge (`externally_connectable`) so a search in Fadi triggers the
  extension to scrape the open portal and stream jobs back — trigger lives inside Fadi.
- On-page overlay: fit score / "should you apply" / "tailor résumé to this JD".
- Richer autofill field maps (Workday/Lever/Greenhouse/iCIMS).

Vanilla MV3 — no build step. Not part of the Next.js app build.
