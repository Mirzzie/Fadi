# MVP Implementation Plan

## Goal

Build a realistic 8-12 week MVP that can acquire the first 100 users and validate Fadi's core value proposition: an honest, proactive AI career operating system. The plan assumes one developer working full time.

## Timeline Summary

Recommended duration: 10 weeks.

Minimum possible: 8 weeks if integrations are simplified.

Safer duration: 12 weeks if resume parsing, LinkedIn import, or job data source access takes longer than expected.

## Week-by-Week Plan

### Week 1: Project Setup and Foundations

Deliverables:

- Next.js 16 app scaffold.
- Better Auth configured with email/password.
- PostgreSQL running locally (Docker).
- Drizzle schema and initial migrations.
- Basic layout and navigation.
- Environment management.

Tech stack confirmation:

- Next.js 16, React 19, TypeScript, Tailwind v4, shadcn/ui.
- Better Auth, Drizzle ORM, PostgreSQL.
- Pluggable model gateway stubbed with OpenAI SDK.

Risk: Low-medium.

### Week 2: Onboarding and Profile

Deliverables:

- Sign-up / sign-in flow (Better Auth).
- Profile form.
- Career goals form.
- User profile persistence via Drizzle repositories.
- Basic dashboard shell.

Risk: Medium.

### Week 3: Resume Upload and LinkedIn Input

Deliverables:

- Resume upload to object storage.
- Resume text extraction.
- Resume summary generation through model gateway.
- LinkedIn paste/import form.
- Parsed profile confirmation with user editing.

Risk: High — document parsing can be messy.

### Week 4: Niche Discovery and Career Analysis

Deliverables:

- Niche discovery conversation: Fadi asks exploratory questions about goals.
- Basic niche validation: Fadi checks the stated direction against available curated market data and returns an honest assessment.
- Career analysis prompt through model gateway.
- Readiness score logic with component breakdown.
- Strengths, weaknesses, gaps, and growth system prescription.
- Career analysis result screen.
- Store analysis history.

Risk: Medium-high — niche validation quality and honest-mentor tone calibration requires iteration.

### Week 5: Career Command Center

Deliverables:

- Fadi-first dashboard: action feed, career summary, next actions.
- Application tracker summary.
- Job recommendation preview.
- Learning preview.
- Empty and loading states that still feel like Fadi.

Risk: Medium.

### Week 6: Job Discovery and Recommendations

Deliverables:

- Job source integration or curated job ingestion (one compliant source).
- Job search UI.
- Match scoring with skill and gap analysis.
- Match explanation generation through model gateway.
- Save and reject actions with preference capture.

Risk: High — job source API access may vary.

### Week 7: Application Tracking and Assets

Deliverables:

- Application list and detail.
- Create application from saved job.
- Manual status updates.
- Notes and next action.
- Resume tailoring draft (model gateway).
- Cover letter draft (model gateway).
- Approval gate UI for generated assets.

Risk: Low-medium.

### Week 8: Learning Recommendations and Fadi Assistant

Deliverables:

- Learning recommendation generation from skill gaps (market demand prioritized).
- Learning list and status updates.
- Fadi assistant API (model gateway, grounded context builder).
- Fadi assistant UI.
- Niche challenge capability in assistant (Fadi pushes back when data warrants it).

Risk: Medium.

### Week 9: Quality, Safety, and Analytics

Deliverables:

- Output validation (Zod) for all AI responses.
- Usage and product event tracking.
- Error handling and safe user-facing messages.
- Rate limits for AI operations.
- Privacy-safe logging (no raw prompts, resume text, or user data in logs).
- Basic admin visibility for first-user support.

Risk: Medium.

### Week 10: Beta Launch

Deliverables:

- Production deployment (Vercel + managed PostgreSQL).
- Production migrations run from `packages/database/migrations`.
- QA across all Fadi flows.
- Invite first users.
- Feedback collection.
- Bug fixing.

Risk: Medium.

## One-Developer Build Sequence

1. Scaffold Next.js 16 with Better Auth and Drizzle.
2. Implement authentication.
3. Create PostgreSQL schema and initial migrations.
4. Build onboarding with profile ingestion.
5. Add resume upload and parsing.
6. Add LinkedIn paste/import.
7. Implement niche discovery and basic niche validation.
8. Generate career analysis through model gateway.
9. Build Fadi command center dashboard.
10. Add job discovery and recommendation matching.
11. Add application tracker and asset generation.
12. Add learning recommendations.
13. Add Fadi assistant with grounded context.
14. Add events and usage tracking.
15. Add deployment, QA, and production launch.

## Cost Estimate for First 100 Users

- Hosting (Vercel): USD 0-50/month initially.
- Database (managed PostgreSQL): USD 0-50/month initially.
- AI usage (OpenAI or equivalent): USD 50-500/month depending on model and usage.
- Job data API: USD 0-300/month depending on source.
- Object storage: USD 0-20/month.
- Domain and misc tools: USD 20-100/month.

Expected MVP operating cost: USD 100-700/month.

## Infrastructure Requirements

Minimum for production:

- Vercel project.
- Managed PostgreSQL (Neon, Supabase Postgres, RDS, or equivalent).
- AI model API key (server-only).
- Object storage bucket.
- Job source API or curated job import.
- Error monitoring.
- Domain.

Not required for Phase 1:

- Kubernetes.
- Vector database.
- Event streaming platform.
- Enterprise infrastructure.
- Dedicated backend service.

## Risk Register

| Risk | Probability | Impact | Mitigation |
| --- | --- | --- | --- |
| Job API access unavailable | High | High | Use curated jobs or one compliant source |
| LinkedIn import limited | High | Medium | Support paste/import fallback |
| Resume parsing poor | Medium | High | Let user edit all profile fields |
| Niche validation too harsh or too vague | Medium | High | Test with real users; calibrate tone |
| AI analysis generic | Medium | High | Use structured inputs and prompt evaluation |
| AI cost grows | Medium | Medium | Add usage limits and cost tracking from week one |
| Scope creep | High | High | Enforce scope freeze |
| One developer overload | Medium | High | Build core flows before polish |
| Privacy mistakes | Medium | High | Minimize stored raw data; no prompt text in logs |

## Launch Criteria

- End-to-end onboarding works with Fadi present throughout.
- Niche validation produces honest, evidence-grounded output.
- Career analysis produces useful, actionable output.
- At least one job source works with match explanations.
- Fadi command center is usable.
- Applications can be tracked.
- Fadi assistant answers grounded questions including challenging ones.
- User data is protected by Better Auth and repository-scoped authorization.
- AI usage is logged (metadata only, no sensitive content).
- Feedback collection exists.
