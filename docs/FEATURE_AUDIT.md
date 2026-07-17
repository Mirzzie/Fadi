# Feature audit — does every nav item actually work, end to end?

*Pass 1: 2026-07-17. Method: for each feature, verify the page renders, its data
source is real, and — the thing that matters most — **clicking things does something.**
Verified against the running app and the real database, not by reading alone.*

The standard here is the user's: "a recommended job I can't click is worse than no
recommendation." A feature that renders but dead-ends fails the audit.

---

## 🔴 FIXED — the flagship dead-end

**Dashboard "Recommended jobs" cards were dead `<div>`s.** They showed title, company,
location, and a match %, but had **no link and no click handler** — clicking did
nothing. The only way onward was the "View jobs" button, which opened a *different*
(live-synced, filtered) set, so the previewed roles often weren't even there.

Fixed: each card is now a link to `/dashboard/applications/{jobId}/workspace` — the same
fit-check → draft → apply flow the Jobs page uses. **Verified the workspace route
returns 200 for a raw job id**, so the link lands on a working page rather than a new
dead-end. Also replaced the empty state's developer instruction ("Run
`npm run db:seed:jobs`") — which was showing to end users — with a real next step.

---

## 🔀 Documents merged into Applications (2026-07-17)

The whole apply flow now lives in one place, because that's how the work actually
happens — paste a JD → create the application → generate its documents — not a trip to
a separate section. That flow already existed inside Applications (the "Add" dialog
takes title/company/JD; the detail panel generates docs); the standalone Documents tab
was redundant.

- **Applications** now has two tabs: **Pipeline** (the board) and **Documents** (the
  full library, folded in via a slot pattern so prop-threading stays in the page).
- **"Documents" removed from the nav.**
- **Editor route `/dashboard/documents/[id]` is unchanged** — every link to it still
  works (verified 200).
- **Old `/dashboard/documents` redirects** to Applications (verified — real redirect,
  not a blank page), so bookmarks don't 404.
- **Base résumé stays in Profile** (where it always lived — nothing orphaned).

## 🌱 Evidence auto-builds at onboarding (2026-07-17)

Evidence was never broken — it works, and the primary user has every input (résumé,
LinkedIn, a working Groq key). It looked broken because building the pool was a hidden,
unexplained manual button nobody pressed, so the platform's single source of truth sat
empty. Onboarding completion now fires `extractEvidencePool` in the background
(`after()`, best-effort, self-guarding on no-history/no-provider), so a new user lands
on a **populated** Evidence tab. Wiring + preconditions verified; the full onboarding→
build loop runs inside Next's runtime (the `server-only` guard prevents standalone
execution, which is the guard working as intended).

## ✅ Verified working (clicks land somewhere real)

| Feature | Renders | Click-through | Notes |
|---|---|---|---|
| **Jobs** | 200 | job → workspace (verified 200) | live sync from Google/Adzuna/Reed/Jooble/Remotive; 991 rows in DB |
| **Applications** | 200 | card → detail panel (`onClick`) | status moves, momentum award on apply-with-doc (fixed earlier) |
| **Documents** | 200 | doc → editor (`router.push`); create/upload wired | 4 docs in DB |
| **Evidence** | 200 | honest empty state + working "build from history" / "add by hand" | 0 rows — empty by capture, not broken; build needs a provider (now free Groq default) |
| **Network** | 200 | honest empty state + working "add referral target" | 0 rows — same; the add flow works |
| **Interview / Learning / Portfolio / Niche / Profile / Settings** | all 200 | — | render clean; action-level deep-dive pending (pass 2) |
| **⌘K command bar** | — | `router.push(app.href)` — navigates to every feature + Fadi | real, not a stub |

No developer commands, `TODO`s, or "coming soon" placeholders leak into any feature's
UI (only the one dashboard empty state, now fixed).

---

## 🟡 Known real issues (from this audit + prior passes)

1. **Dashboard preview vs Jobs page show different job sets.** The dashboard reads
   *stored* jobs, unfiltered, no live pull (`skipSync: true`, limit 3); the Jobs page
   does a live re-sync and applies your location/type filters. So the previewed roles
   can differ from what "View jobs" shows. The click now *works* (→ workspace), but the
   two sets still aren't identical. Product decision: should the preview mirror the
   filtered live set, or stay "top unfiltered matches"?

2. **Location detection is inherently imprecise.** "Detect my region" maps the
   browser's *language* to a country (`en-GB → UK`), which is wrong for anyone whose
   language ≠ location. The privacy promise (no GPS, no third party) forces this. The
   country dropdown next to it is the accurate path.

3. **Voice output (the speaker icon) is off by default and undiscoverable.** It's
   Fadi's voice mute-toggle, defaulting to off — which is why it never speaks. When on,
   it needs a TTS provider (OpenAI) and falls back to the browser's free voice on 503.
   Recommendation: cut it (unvalidated for the target user) rather than polish it.

4. **Merge Applications + Documents?** Documents also exist standalone (base résumé,
   portfolio), so a naive merge orphans those. Recommended middle path: surface each
   application's documents *inside* the application card, keep the Documents library.

---

## Still to deep-verify (pass 2)

Action-level for Interview (prep/stories/mock), Learning (commit → complete → evidence),
Portfolio (build → publish → public page), Niche-finder, Profile, Settings — each
renders 200, but the individual actions haven't been driven end-to-end yet.
