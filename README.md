# Fadi

> Formerly "CareerOS AI". The codebase's internal package scope is still `@careeros/*`
> and the local Postgres role is `careeros` — those are functional identifiers, not the
> brand. The product is **Fadi**.

**Fadi is an AI operating system for a person's career.** Instead of a folder of
disconnected tools (a job board here, a resume editor there, a spreadsheet to track
applications), it is one always-present intelligent environment that helps someone decide
*where* to aim their career, *find* the right opportunities, *prepare* strong applications,
get through the grind of a job search, and *understand* how the wider world affects their
path.

At the center is **Fadi** — an AI mentor (not a chatbot widget) present across the whole
product. The brand promise: *a calm, honest, intelligent partner that helps you get hired
without losing your mind* — for **any** career, not just tech.

Its non-negotiable doctrine (see [`docs/FadiOS-Project-Context.md`](docs/FadiOS-Project-Context.md)):
score the **process, never the outcome**; protect the user's mental health and locus of
control; **honesty above everything** (never invent a job, statistic, or the user's
experience); **quality over volume** (anti-spray); the user's real history is the source of
truth.

Recent capability: users can **publish their portfolio to their own GitHub Pages** as a
full static site (hero, animations, case studies) directly from the app — see
[`docs/PORTFOLIO_WEBSITE_ENGINE.md`](docs/PORTFOLIO_WEBSITE_ENGINE.md) and ADRs
[0008](docs/adr/0008-github-portfolio-publishing.md)/[0009](docs/adr/0009-portfolio-hosting-and-static-export.md).

---

## Stack

- **Next.js (App Router) + TypeScript** — the app in `apps/web`
- **Tailwind CSS v4** + shadcn-style UI primitives
- **Better Auth** — email/password authentication (no Supabase needed)
- **PostgreSQL 17** — local via Docker, production-compatible; **Drizzle ORM** + committed migrations
- **Multi-provider AI** — Groq / Google Gemini / Anthropic / OpenAI, server-default with
  per-user BYOK. Groq's free tier is the recommended default.
- **npm workspaces monorepo** — `apps/*` + `packages/*`

---

## Repository structure

```text
.
├── apps/
│   ├── web/                  # The Next.js application (the product)
│   └── portfolio-export/     # Static-export build of a user's portfolio (GitHub Pages target)
├── docs/                     # Product, architecture, and engineering docs (start here to learn the app)
│   └── adr/                  # Architecture Decision Records
├── infrastructure/
│   ├── docker/               # Local PostgreSQL (docker-compose.yml)
│   ├── supabase/             # LEGACY historical migrations only — not used at runtime
│   └── vercel/
├── packages/
│   ├── database/             # Drizzle schema, migrations, repositories, seeds
│   ├── shared/ · types/ · ui/
├── scripts/
└── tests/
```

---

## Getting started (fresh machine)

### 1. Prerequisites

| Tool | Version | Notes |
| --- | --- | --- |
| **Node.js** | ≥ 20.11.0 | `node -v` |
| **npm** | ≥ 10 | ships with recent Node |
| **Docker** | any recent | runs local PostgreSQL. (Alternatively, point `DATABASE_URL` at your own Postgres 17.) |

### 2. Clone and install

```bash
git clone https://github.com/Mirzzie/Fadi.git
cd Fadi
npm install          # installs every workspace (apps/* and packages/*)
```

### 3. Configure environment

The app reads `apps/web/.env.local`. Copy the template and fill in two things:

```bash
cp apps/web/.env.example apps/web/.env.local
```

Then edit `apps/web/.env.local`:

```env
# REQUIRED — generate one with:  openssl rand -base64 32
BETTER_AUTH_SECRET=replace-with-a-strong-secret

# REQUIRED for AI features — Groq has a free tier: https://console.groq.com/keys
GROQ_API_KEY=your-key-here
# (or set GOOGLE_API_KEY / ANTHROPIC_API_KEY / OPENAI_API_KEY instead;
#  leave AI_PROVIDER blank to auto-pick the first key present)
```

You do **not** need to set `DATABASE_URL` for local dev — it defaults to the Docker
instance below (`postgres://careeros:careeros@localhost:5433/careeros`). The app boots
without an AI key, but AI features (Fadi's guidance, Career Intelligence Report, etc.)
won't work until one is set.

### 4. Start the database and apply migrations

```bash
npm run db:up        # starts PostgreSQL 17 in Docker (host port 5433)
npm run db:migrate   # applies committed Drizzle migrations
npm run db:seed:jobs # seeds local job data used by discovery
```

### 5. Run the app

```bash
npm run dev
```

Open **http://localhost:3000**, then **sign up** (email/password) and follow onboarding —
that first run creates your user and walks through the Career Intelligence flow as a fresh
user would experience it.

---

## Everyday commands

| Command | What it does |
| --- | --- |
| `npm run dev` | Start the app (Next.js dev server) |
| `npm run db:up` / `npm run db:down` | Start / stop the local Postgres container |
| `npm run db:migrate` | Apply migrations |
| `npm run db:reset` | **Destroy** the DB volume, recreate, and re-migrate (fresh slate) |
| `npm run db:studio` | Open Drizzle Studio to browse the DB |
| `npm run db:seed:jobs` | Re-seed job data |
| `npm run lint` · `npm run typecheck` · `npm run test` | Quality gates |
| `npm run build` · `npm run start` | Production build / serve |
| `npm run test:e2e` | Playwright end-to-end tests |
| `npm run format` | Prettier write |

To generate a new migration after changing the Drizzle schema: `npm run db:generate`.

---

## Where to learn the app (docs)

Read these in order to get productive:

1. [`docs/FadiOS-Project-Context.md`](docs/FadiOS-Project-Context.md) — **what Fadi is and what it believes** (the doctrine that shapes every feature). Start here.
2. [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — how the system is put together.
3. [`docs/POSTGRES_FIRST_ARCHITECTURE.md`](docs/POSTGRES_FIRST_ARCHITECTURE.md) · [`docs/DATABASE_SCHEMA.md`](docs/DATABASE_SCHEMA.md) — data layer.
4. [`docs/AUTHENTICATION_ARCHITECTURE.md`](docs/AUTHENTICATION_ARCHITECTURE.md) — Better Auth setup.
5. [`docs/DEVELOPMENT_GUIDE.md`](docs/DEVELOPMENT_GUIDE.md) · [`docs/CODING_STANDARDS.md`](docs/CODING_STANDARDS.md) · [`docs/CONTRIBUTING.md`](docs/CONTRIBUTING.md) · [`docs/GIT_WORKFLOW.md`](docs/GIT_WORKFLOW.md) — how to work in the repo.
6. [`docs/adr/`](docs/adr/) — the decisions and *why* behind them.

The full `docs/` folder covers each engine (job discovery, learning, market intelligence,
onboarding, portfolio, etc.) in depth.

---

## Engineering rules

- Keep the product operable by a small team. New database access goes through
  **repository/service modules**, and user-owned domain data stays linked to the
  app-owned `users.id`.
- **Honesty in the code, too:** never fabricate data a user will see. When data is
  missing, say so — mirroring the product's core doctrine.
