# MVP Implementation Plan

## Goal

Build a realistic 8-12 week MVP that can acquire the first 100 users. The plan assumes one developer working full time.

## Timeline Summary

Recommended duration: 10 weeks.

Minimum possible: 8 weeks if integrations are simplified.

Safer duration: 12 weeks if resume parsing, LinkedIn import, or job data source access takes longer.

## Week-by-Week Plan

### Week 1: Project Setup and Foundations

Deliverables:

- Next.js app scaffold.
- Supabase project.
- Database migrations.
- Auth setup.
- Basic layout and navigation.
- Environment management.

Risk: Low-medium.

### Week 2: Onboarding and Profile

Deliverables:

- Signup/login flow.
- Profile form.
- Career goals form.
- User profile persistence.
- Basic dashboard shell.

Risk: Medium.

### Week 3: Resume Upload and LinkedIn Input

Deliverables:

- Resume upload to storage.
- Resume text extraction.
- Resume summary generation.
- LinkedIn paste/import form.
- Parsed profile confirmation.

Risk: High because document parsing can be messy.

### Week 4: Career Analysis

Deliverables:

- Career analysis prompt.
- Readiness score logic.
- Strengths, weaknesses, gaps, next actions.
- Career analysis result screen.
- Store analysis history.

Risk: Medium-high because analysis quality drives activation.

### Week 5: Career Dashboard

Deliverables:

- Dashboard with readiness, summary, next actions.
- Application tracker summary.
- Job recommendation preview.
- Learning preview.
- Empty and loading states.

Risk: Medium.

### Week 6: Job Discovery and Recommendations

Deliverables:

- Job source integration or curated job ingestion.
- Job search UI.
- Match scoring.
- Match explanation generation.
- Save/reject actions.

Risk: High because job source access may vary.

### Week 7: Application Tracking

Deliverables:

- Application list.
- Application detail.
- Create application from saved job.
- Manual status updates.
- Notes and next action.

Risk: Low-medium.

### Week 8: Learning Recommendations and Assistant

Deliverables:

- Learning recommendation generation from skill gaps.
- Learning list and status updates.
- AI assistant API.
- Assistant UI.
- Grounded assistant context builder.

Risk: Medium.

### Week 9: Quality, Safety, Analytics

Deliverables:

- Output validation.
- Usage and product event tracking.
- Error handling.
- Rate limits.
- Privacy-safe logging.
- Basic admin view or database queries for first-user support.

Risk: Medium.

### Week 10: Beta Launch

Deliverables:

- Production deployment.
- Seed onboarding content.
- QA across flows.
- Invite first users.
- Feedback collection.
- Bug fixing.

Risk: Medium.

## One-Developer Build Sequence

1. Scaffold Next.js and Supabase.
2. Implement auth.
3. Create database tables.
4. Build onboarding.
5. Add resume upload and parsing.
6. Add LinkedIn paste/import.
7. Generate career analysis.
8. Build dashboard.
9. Add job discovery.
10. Add job recommendations.
11. Add application tracker.
12. Add learning recommendations.
13. Add AI assistant.
14. Add events and usage tracking.
15. Add deployment and QA.

## Cost Estimate

For first 100 users:

- Hosting: USD 0-50/month initially.
- Database/storage: USD 0-50/month initially.
- AI usage: USD 50-500/month depending on model, prompt size, and chat usage.
- Job data API: USD 0-300/month depending on source.
- Domain and misc tools: USD 20-100/month.

Expected MVP operating cost: USD 100-700/month.

Development cost if built by founder/developer: time cost only.

Development cost if outsourced: likely USD 15,000-60,000 depending on quality and region.

## Infrastructure Requirements

Minimum:

- Vercel project.
- Supabase project.
- OpenAI API key.
- Job source API or curated job import.
- Error monitoring.
- Domain.

Optional for beta:

- Analytics tool.
- Email provider.
- Resume parsing service.

Not required:

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
| Resume parsing poor | Medium | High | Let user edit profile fields |
| AI analysis generic | Medium | High | Use structured inputs and prompt evaluation |
| AI cost grows | Medium | Medium | Add usage limits and logs |
| Scope creep | High | High | Enforce exclusions in scope freeze |
| One developer overload | Medium | High | Build CRUD and AI flows before polish |
| Privacy mistakes | Medium | High | Minimize stored raw prompts and add RLS |

## Launch Criteria

- End-to-end onboarding works.
- Career analysis produces useful output.
- At least one job source works.
- Job recommendations include explanations.
- Dashboard is usable.
- Applications can be tracked.
- Assistant answers grounded questions.
- User data is protected by auth and row-level security.
- AI usage is logged.
- Feedback collection exists.

