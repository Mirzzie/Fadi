# Real-Time Data Sources & Live Market Intelligence

How CareerOS gets trustworthy, up-to-date signal about jobs, the labor market,
the economy/geopolitics, and AI/skill shifts — and how all of it is wired
through the Fadi Throne so it becomes *personalized* intelligence, not a news feed.

Governed by [[PLATFORM_IDEOLOGY]] (honest intelligence, quality over volume) and
the psychological-lens mandate (this data must reduce anxiety with context, not
manufacture it). Last updated 2026-06-03.

---

## 0. The principle for external data

We never show raw feeds. Every external signal is **scored for relevance against
the user's own profile** (target role, skills, gaps, location, seniority) before
Fadi ever surfaces it. A layoff in a sector you don't target is noise; a layoff in
yours is context that protects your morale ("it's the market, not you") and may
change your strategy. **Signal → normalize → store → score against profile →
Fadi decides if/how to surface.**

We also follow the AI-provider pattern already in `lib/ai/`: every source is a
pluggable provider with an honest `isConfigured` flag. **No key → the source
politely reports itself unavailable. We never fake data.**

---

## 1. Live job postings & application liveness

Goal: dynamic, trustworthy job listings + detect when an official poster has
**closed a role or stopped accepting applications** (so we never push a user to
spend their limited energy on a dead posting).

| Source | Coverage | Cost | Key? | Integration |
|---|---|---|---|---|
| **Direct ATS feeds** — Greenhouse (`boards-api.greenhouse.io/v1/boards/{co}/jobs`), Lever (`api.lever.co/v0/postings/{co}`), Ashby, Workday | The *source of truth* for thousands of employers | **Free** | No | REST per-company. **Liveness: if a job ID 404s or drops from the board list → closed / no longer accepting.** This is the most authoritative expiry signal we can get. |
| **JSearch** (OpenWeb Ninja / RapidAPI) | Aggregates Google for Jobs → LinkedIn, Indeed, Glassdoor, ZipRecruiter | **Freemium** (free tier ~200 req/mo; paid scales) | Yes | REST via RapidAPI. Best breadth + salary data. |
| **Adzuna** | Aggregator, 16 countries, + salary & market stats | **Free** dev tier (rate-limited), attribution required | Yes (`app_id`+`app_key`) | REST. Also powers market-stats charts (histogram/region). |
| **Jooble** | Global aggregator | **Free** key on request | Yes | POST search. |
| **Remotive** | Remote jobs | **Free**, no key | No | Single JSON endpoint. Easiest first integration. |
| **Arbeitnow** | EU + ATS-sourced board | **Free**, no key | No | REST. |
| **USAJOBS** | US federal | **Free** | Yes (email + key) | REST. |
| **The Muse** | Jobs + company culture | **Free** | Optional | REST. |
| **TheirStack / Cavuno** | Historical + expiry + dedup done for you | **Paid** | Yes | Use only if DIY expiry handling proves insufficient. |

**Ghost-job / repost detection** (49% AI-dismiss + ghost-posting problem): track
`first_seen_at` ourselves and compare to the ATS `updated_at`/`posted_at`; flag
postings that are reposted or stale. Surfaces as a Fadi warning, not a silent drop.

**Recommended start (free, no key):** Remotive + Arbeitnow + direct Greenhouse/
Lever feeds for liveness. Add Adzuna (free key) for salary/market stats, then
JSearch when budget allows for breadth.

---

## 2. Labor market, wages & skill demand (the analysis backbone)

Goal: ground every recommendation in real demand data and analyze it **against
the user's profile and expertise**.

| Source | What it gives | Cost | Key? | Integration |
|---|---|---|---|---|
| **BLS Public Data API** | Unemployment, JOLTS openings/hires/quits, OEWS wages by occupation, **2024–34 employment projections**, skills importance (O*NET-based) | **Free** (key → 500 req/day vs 25) | Optional key | REST by series ID. |
| **O*NET Web Services** | Occupation → skills/tasks/technologies, **transferable-skill mapping**, bright-outlook/declining flags | **Free** | Yes | REST. Core of skill-gap-vs-role analysis. |
| **Lightcast Open Skills** | 32k+ skill taxonomy, skill relatedness, extract/normalize skills from resumes & JDs | **Free** taxonomy (full market data is paid/custom) | Yes (free tier) | REST + downloadable taxonomy. Use to normalize messy skill strings. |
| **FRED** (St. Louis Fed) | Macro: unemployment trend, CPI, sector employment, recession signals | **Free** | Yes | REST by series ID. |
| **Eurostat / OECD** | Non-US labor data | **Free** | No | REST. For international users. |

These feed the existing **`career-trajectory.ts`** algorithm (its `marketDemand`
input is currently hand-set — wire it to BLS/O*NET) and the skill-gap analysis in
the Career Intelligence Report.

---

## 3. Geopolitical & economic events affecting the job market

Goal: when something structural shifts (sector layoffs, rate hikes, a regional
shock), Fadi gives **honest context** — both for strategy and for morale.

| Source | What it gives | Cost | Key? | Integration |
|---|---|---|---|---|
| **GDELT 2.0** | Global events every **15 min**, 100+ languages, CAMEO-coded — layoffs, sector disruption, regional instability | **Free**, no key | No | REST/Doc API + BigQuery. **Best geopolitical/economic signal for free.** |
| **finlight.me** | Real-time financial + market-moving news, clean JSON | Freemium | Yes | REST. Sector/company shocks. |
| **Mediastack** | General news | **Free** 500/mo; $9.99+/mo | Yes | REST. |
| **GNews** | 60k+ sources | **Free** 100/day; $84+/mo | Yes | REST. |
| **NewsAPI** | 150k sources | Free 100/day (non-commercial only); **$449+/mo for prod** | Yes | Avoid for production cost. |
| **layoffs.fyi** | Tech layoffs tracker | Free dataset | No (scrape/dataset) | Ingest periodically. |

**Recommended start:** GDELT (free, rich, keyless) as the geopolitical/economic
backbone; add finlight or Mediastack later for cleaner financial headlines.

---

## 4. AI developments & in-demand skill shifts (so users upskill for the *modern* industry)

Goal: detect where the industry is moving (esp. AI) and tell the user **how to
improve relative to their current expertise** — analyzed against their profile.

| Source | What it gives | Cost | Key? | Integration |
|---|---|---|---|---|
| **Hacker News** (Algolia Search API + Firebase API) | Trending tech/AI topics; **"Who is hiring" threads** = raw demand signal | **Free**, no key | No | REST. `hn.algolia.com/api/v1/search`. |
| **GitHub REST/GraphQL** | Trending repos/topics, language momentum, Octoverse | **Free** w/ token (higher limits) | Token | REST/GraphQL. Tech adoption velocity. |
| **Stack Exchange API** | Tag trends (which techs are rising/falling) | **Free** | Optional | REST. |
| **arXiv API** | AI research velocity by topic | **Free**, no key | No | Atom/REST. Leading indicator of where AI is heading. |
| **Google Trends** | Search interest in skills/tools | No official API | — | Use SerpApi (paid) or skip. Treat as soft signal. |

**Algorithm:** intersect rising-skill signals with the user's **skill gaps** (from
the Career Report) and target role (O*NET skills). Output: "X is accelerating in
your field and you don't have it yet — here's a concrete 2-week path." This is the
"proof of work beats credentials" principle made continuous.

---

## 5. Enrichment (supporting capabilities)

| Need | Source | Cost |
|---|---|---|
| Resume/JD parsing | DIY (pdf-parse + our LLM) preferred; Affinda/Sovren paid | Free / Paid |
| Referral email discovery | Hunter.io | Freemium |
| Geocoding for geo-matching | Nominatim (OSM) — already have `lib/geo/` | Free |
| Company intel | Clearbit (paid); avoid LinkedIn (TOS-restricted) | Paid |

---

## 6. Architecture — wiring it through the Fadi Throne

```
External APIs ─┐
  (Sec. 1–5)   │   ┌─────────────────────────────────────────────┐
               ├──▶│  lib/data-sources/  (pluggable providers)    │
               │   │  • typed contracts per capability            │
               │   │  • registry (env-driven, isConfigured honesty)│
               │   │  • normalizers → canonical shapes            │
               │   └───────────────┬─────────────────────────────┘
                                   │ ingest (scheduled) + on-demand
                                   ▼
                        ┌──────────────────────┐
                        │  market_signals store │  (cached, deduped, TTL)
                        │  job_posting_checks   │  (liveness/expiry)
                        └──────────┬────────────┘
                                   │ relevance scoring vs profile
                                   ▼
        ┌──────────────────────────────────────────────────────────┐
        │  Fadi Throne (orchestrator)                                 │
        │   └─ Market-Intelligence mini-agent                        │
        │        • personalized "what changed in your market" brief  │
        │        • skill-shift alerts vs YOUR gaps                    │
        │        • geopolitical/economic morale context              │
        │        • liveness alerts ("3 saved jobs closed")           │
        └───────┬───────────────┬───────────────┬───────────────────┘
                ▼               ▼               ▼
   career-trajectory      Resilience Engine    Fadi chat/voice
   (marketDemand input)   (morale framing)     (context)
```

### Provider contract (mirrors `lib/ai/providers/`)
Each source implements a category interface (`JobSource`, `LaborMarketSource`,
`NewsSignalSource`, `SkillTrendSource`) and exposes `id`, `name`, `isConfigured`,
`capabilities`. A registry builds the configured set from env; unconfigured
sources report themselves unavailable rather than erroring.

### Ingestion
- **Scheduled refresh** (cron / route): GDELT + news every ~30 min, HN/GitHub
  daily, BLS/O*NET weekly (slow-moving). Results normalized into `market_signals`
  with a TTL so we never hammer rate limits and can analyze offline.
- **Job-liveness poller**: for each tracked/saved application, re-check the ATS
  endpoint; on 404/drop, mark `closed` and notify Fadi.

### Relevance algorithm (`lib/data-sources/relevance.ts`)
Score each signal 0–100 against the user profile:
`relevance = w₁·roleMatch + w₂·skillMatch + w₃·regionMatch + w₄·sectorMatch + w₅·recency`
Only signals above a threshold are surfaced, ranked. This is what turns a global
firehose into "your three things that matter today."

### Where it plugs in
- **`career-trajectory.ts`** — replace the hand-set `marketDemand` with live
  BLS/O*NET/GDELT-derived demand for the target role.
- **Resilience Engine** — sector-wide rejection/layoff context feeds the morale
  framing ("rejections are up across your field this quarter — adjust, don't
  despair").
- **Fadi context builder** (`lib/ai/context/builder.ts`) — top personalized
  signals injected so Fadi can speak to them in chat/voice.

---

## 7. Cost summary & rollout

**Phase A — $0, no keys (start here):** Remotive, Arbeitnow, direct Greenhouse/
Lever (jobs + liveness), GDELT (geopolitics/economy), Hacker News + arXiv (AI/skill
trends), BLS (labor data, keyless 25/day). Proves the entire pipeline for free.

**Phase B — free keys:** Adzuna (salary/market stats), O*NET, FRED, Lightcast Open
Skills, USAJOBS, GitHub token. Still $0, richer analysis.

**Phase C — paid when scale/coverage demands:** JSearch (breadth via Google for
Jobs), finlight/Mediastack (clean financial news), TheirStack/Cavuno (managed
expiry/dedup), Hunter.io (referrals). Spend only where free coverage is the
bottleneck.

**Principle:** every paid source must clear the ideology's standard — does it
genuinely improve the user's competitive position more than the free alternative?
If not, it doesn't ship.
