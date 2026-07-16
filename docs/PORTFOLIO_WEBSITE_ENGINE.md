# Portfolio Website Engine

A from-concept brief for FadiOS's portfolio capability. The portfolio is **not a
new data silo** — it is one more *projection* of the user's career history, in
exactly the same way a tailored résumé is. Update the history once; the résumé,
the portfolio, and every other output follow. This document defines what the
feature is, how it obeys FadiOS's beliefs, its data model (grounded in the real
Drizzle schema), the AI generation loop, the stack-agnostic delivery contract,
and the MVP slice.

---

## 1. Purpose

Let a user **manage and publish a portfolio website from inside FadiOS**, so that
adding one project (or finishing a learning commitment) updates *both* their
résumé *and* their portfolio site, with Fadi's AI rewriting each output for its
own context. The user controls everything from one place; the public website is
just a rendered view of data Fadi already holds.

The public site itself is a **read-only render**. FadiOS owns the content, the
CMS, and the AI. Hosting the rendered site is a thin, replaceable layer.

---

## 2. How it obeys the FadiOS beliefs

- **History is the source of truth (belief 7).** Portfolio content is derived
  from `evidence_items` (the user's real projects, experience, achievements),
  never invented. A portfolio is a *curated, presentation-enhanced excerpt* of
  that history — the same status a tailored résumé has.
- **Honesty (belief 3).** Fadi may draft portfolio copy *from* real evidence, but
  never fabricates a project, a metric, or an outcome. If evidence is thin, it
  says so and invites the user to add more — it does not embellish.
- **Domain-agnostic.** A nurse, an electrician, and a data analyst must each get a
  credible portfolio. No field assumptions; sections and language come from the
  user's own `evidence_items` and active `career_profile`.
- **Provider-agnostic AI (1.5).** All portfolio generation runs through the
  user's connected AI provider/key via the existing AI layer. No provider → the
  CMS still works for manual editing; generation shows an honest "connect a
  provider" state.
- **Active direction drives it (3.3).** A portfolio site belongs to a
  `career_profile` (track). Switching the active direction can switch which
  portfolio is primary, mirroring how résumés are per-track.

---

## 3. The core model: projection, not duplication

```
   CAREER HISTORY (source of truth)                Projections (per context, AI-tailored)
   ┌───────────────────────────────┐              ┌──────────────────────────────────────┐
   │ evidence_items                 │   Fadi AI    │ resumes            (concise, ATS)      │
   │  kind · title · organization · │ ───project──▶│ portfolio_items    (narrative, visual)│
   │  period · detail · metrics ·   │              │ cover letters / LinkedIn (future)     │
   │  tags                          │              └──────────────────────────────────────┘
   │ career_profiles (active track) │                          │ headless delivery
   │ profiles (name, contact)       │                          ▼
   └───────────────────────────────┘              Content API (stack-agnostic JSON)
                                                              │
                                          ┌───────────────────┼───────────────────┐
                                          ▼                   ▼                   ▼
                                    Fadi template        user's own site      any stack
                                    (/p/<handle>)        (Next/Astro/WP)      via SDK/API
```

The user edits **one place** (FadiOS). The website is a consumer of the API.
There is no second CMS to keep in sync, and no two-way editing of the public
site — which removes the entire class of sync/conflict bugs.

---

## 4. Data model (new tables — follows existing schema conventions)

All tables follow the repo's conventions: `uuid` PK `defaultRandom()`, a
`user_id` FK to `users` with `onDelete: "cascade"`, the shared `timestamps`
helper, `jsonb` for arrays. Per `MULTI_TENANT_SAAS_ARCHITECTURE.md`, add
`tenant_id` now (nullable in Phase 1) to avoid a painful later migration. All
access goes through repository/service modules with strict `user_id` scoping.

### 4.1 `portfolio_sites`

One row per portfolio a user owns (usually one per `career_profile`).

| column | type | notes |
|---|---|---|
| id | uuid PK | |
| user_id | uuid FK → users | cascade |
| tenant_id | uuid nullable | Phase-1 forward-compat |
| career_profile_id | uuid FK → career_profiles | `set null`; which track this presents |
| handle | text unique | public slug → `/p/<handle>` |
| title | text | site title |
| headline | text | hero tagline (AI-drafted from track) |
| template | text | template id; default `"noir-gold"` (the ported design) |
| theme | jsonb | template config/overrides (mirrors `resume_templates.config`) |
| profile | jsonb | name, location, email visibility, links, avatar url |
| resume_links | jsonb | per-persona résumé URLs (support/cloud/security/default) |
| is_published | boolean | default false; gates the public API |
| ...timestamps | | |

Indexes: `(user_id)`, unique `(handle)`, `(user_id, career_profile_id)`.

### 4.2 `portfolio_items`

The curated, presentation-enhanced content shown on a site. Each item **may
reference** an `evidence_items` row (the fact it presents) and adds portfolio-only
presentation fields. This is the direct port of the existing portfolio
`ContentItem` model.

| column | type | notes |
|---|---|---|
| id | uuid PK | |
| user_id | uuid FK → users | cascade |
| tenant_id | uuid nullable | |
| site_id | uuid FK → portfolio_sites | cascade |
| evidence_item_id | uuid FK → evidence_items | `set null`; the source fact (nullable → portfolio-only item) |
| section | text | project · experience · education · certification · skill · custom |
| title | text | |
| subtitle | text | org / institution |
| date_range | text | maps to evidence `period` |
| description | text | AI-drafted narrative blurb (portfolio voice) |
| bullets | jsonb string[] | highlights |
| roles | jsonb string[] | persona targeting (support/cloud/security) |
| tag | text | category chip |
| url | text | **source link** (repo / live / case-study) |
| image_url | text | cover (Cloudinary/R2) |
| gallery | jsonb string[] | extra images/videos |
| sort_order | integer | |
| is_published | boolean | draft vs live |
| ...timestamps | | |

Indexes: `(user_id)`, `(site_id)`, `(site_id, section)`, `(evidence_item_id)`.

**Shared vs. presentation fields.** The *facts* (`title, subtitle, date_range,
bullets, tag`) originate from `evidence_items` and re-sync when the evidence
changes. The *presentation* (`description` blurb, `image_url`, `gallery`,
`sort_order`, `is_published`, `roles`) is portfolio-only and never flows back —
this is how we get single-source-of-truth without two-way-edit conflicts.

### 4.3 Templates

Phase 1 ships one template (`noir-gold`, the ported design). Additional templates
are just renderers that consume the same Content API; a `template` id + `theme`
jsonb on `portfolio_sites` is enough. No per-user template table needed yet.

---

## 5. The generation loop (AI projection)

1. **Seed.** When a user opens the portfolio builder, Fadi proposes
   `portfolio_items` from their existing `evidence_items` for the active
   `career_profile` — grouped into sections, ordered, with a first-pass narrative
   `description` and `bullets` written in a portfolio voice (distinct from the
   résumé's ATS voice).
2. **Curate.** The user edits, reorders, toggles publish, uploads media. Nothing
   is invented; Fadi only rewrites what the evidence supports.
3. **Re-sync on change.** When an `evidence_item` changes (e.g. a completed
   `learning_commitment` becomes new evidence), Fadi flags the linked
   `portfolio_item` as "update available" and can regenerate its factual fields —
   presentation fields are preserved.
4. **Publish.** Setting `is_published` exposes the item via the Content API.

All model calls go through the user's connected provider (`user_ai_settings`).
Honest degradation when no provider is connected.

---

## 6. Delivery: the Content API (stack-agnostic)

The public contract is **JSON over HTTPS**, so any website — Next, Astro,
WordPress, a hand-coded site, or a Fadi template — can render a portfolio without
sharing code with FadiOS.

```
GET /api/portfolio/:handle           → published site + items (public, cached)
GET /api/portfolio/:handle/preview   → includes drafts (owner-authenticated)
```

Response (shape):

```jsonc
{
  "site": { "handle": "mirzad", "title": "...", "headline": "...",
            "template": "noir-gold", "theme": { ... },
            "profile": { "name": "...", "location": "...", "links": [ ... ] },
            "resumeLinks": { "default": "...", "cloud": "..." } },
  "items": [ { "section": "project", "title": "...", "description": "...",
               "bullets": [ ... ], "tag": "...", "url": "...",
               "imageUrl": "...", "gallery": [ ... ], "roles": [ ... ] } ]
}
```

Rules:
- Public endpoint returns **only `is_published` items of a published site**.
- Strict `user_id`/handle scoping in the repository — one user's data can never
  appear under another's handle.
- Cacheable (CDN / ISR); a publish action revalidates.

This is the answer to "what if the user has a different web stack?": they consume
this API. Users without a stack use a Fadi-hosted template at `/p/<handle>`.

---

## 7. CMS surface (inside the dashboard)

A `dashboard/portfolio` area, reusing the résumé/document UX patterns already in
the app:

- **List** the user's portfolio sites (Phase 1: one).
- **Edit** items per section (projects, experience, education, certs, skills,
  gallery) — CRUD, drag-reorder, publish toggle, media upload.
- **Résumés per position** — the per-persona résumé links.
- **Live preview** — the site embedded in an iframe with draft + "preview as
  recruiter/cloud/security" toggles.
- **Publish** — flips `is_published`, revalidates the public render.

---

## 8. Media

Phase 1: Cloudinary free tier (unsigned upload preset), as already proven in the
standalone portfolio. Add per-user storage caps and, at scale, migrate to
Cloudflare R2 (free egress) or Supabase Storage. Store only the resulting URL on
`portfolio_items`.

---

## 9. Multi-tenancy & security

Follows `MULTI_TENANT_SAAS_ARCHITECTURE.md` Phase 1:
- Shared Postgres, `user_id` on every table, strict row-level checks in
  repositories/services.
- `tenant_id` added now (nullable) for forward-compat.
- Public API exposes only published content; drafts require the owner's session.
- Entitlement hook (even if all users are on one plan) so portfolio can later be a
  paid capability — ties into `SUBSCRIPTION_AND_MONETIZATION.md`.

---

## 10. MVP slice (Phase 1 — prove the loop for one user)

1. Migrations for `portfolio_sites` + `portfolio_items` (+ repositories).
2. Seed a site + items from the active track's `evidence_items` (with AI drafts).
3. `dashboard/portfolio` CRUD + media + publish + preview.
4. Public `GET /api/portfolio/:handle` (published only).
5. One template renderer (`noir-gold`) at `/p/:handle` consuming the API — the
   ported design from the standalone portfolio.

Success = *add one `evidence_item` in Fadi → it appears (AI-written) on both the
résumé and the live portfolio, with no second data entry.*

---

## 11. Non-goals (Phase 1)

- Custom domains per user (offer `/p/<handle>` first).
- Multiple templates/themes (ship one).
- Two-way editing (the public site is read-only; edit in Fadi).
- Team/org tenants.

---

## 12. Migration note (standalone portfolio → FadiOS)

A standalone portfolio already exists (TanStack + Firebase + Cloudinary). It is
**ported, not merged**:
- **Reused:** the visual design, animated home, case-study/gallery/lightbox UI,
  and the `ContentItem` content model (→ `portfolio_items`).
- **Rewritten:** data layer (Firebase → Postgres/Drizzle), CMS (TanStack routes →
  `dashboard/portfolio`), auth (Firebase Auth → better-auth), delivery (direct
  Firestore reads → Content API).
- **Retired:** Firebase/Firestore. The single source of truth is FadiOS Postgres.

---

## 13. Open questions

- Handle namespace + reservation/collision rules (and profanity/impersonation).
- Whether `portfolio_sites` is strictly 1:1 with `career_profiles` or can be
  standalone.
- Where "publish" sits relative to entitlements (free vs paid).
- Subdomain (`<handle>.fadi.app`) vs path (`/p/<handle>`) for v1 hosting.
