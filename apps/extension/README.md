# Fadi Browser Extension (MVP)

The third leg of Fadi's job discovery: where the **APIs** cover open boards and the **Fadi
scraper** covers the API-less long tail, the **extension** captures **login-walled sites**
(LinkedIn, Indeed, company ATS) using the user's own authenticated session — the legal,
human-in-the-loop path — plus **application autofill**.

## What it does (MVP)

- **Save this job to Fadi** — reads the job on the current page (JSON-LD `JobPosting` →
  Open Graph → sensible fallbacks) and POSTs it to `POST /api/extension/capture`, which saves
  it to the user's pipeline. Works on any site the user can see.
- **Autofill this application** — fills obviously-named fields (name/email/phone/location)
  from cached profile basics and **never submits** (the user reviews).

## Load it (Chrome/Edge, unpacked)

1. Run Fadi (`npm run dev`) and sign in.
2. `chrome://extensions` → enable **Developer mode** → **Load unpacked** → select this
   `apps/extension` folder.
3. Open a job posting, click the Fadi icon → **Save this job to Fadi**. Set the Fadi URL in
   the popup if it isn't `http://localhost:3000`.

## Auth caveat (productionization)

The capture endpoint reuses the **Fadi session cookie** (`credentials: "include"`). For that
cookie to be sent cross-site from the extension, Better Auth's session cookie must be
`SameSite=Lax` (default) and, in production over HTTPS, `Secure`. If cookie auth proves
unreliable across browsers, switch to a **capture token**: generate one in Fadi settings,
paste it into the extension, and have the endpoint accept `Authorization: Bearer <token>`.
That's the robust, browser-agnostic path most tools use.

## Roadmap

- Fetch the live Fadi profile for richer autofill (Workday/Lever/Greenhouse/iCIMS field maps).
- On-page overlay: fit score / "should you apply" / "tailor résumé to this JD".
- Evidence + networking capture.

Vanilla MV3 — no build step. Not part of the Next.js app build.
