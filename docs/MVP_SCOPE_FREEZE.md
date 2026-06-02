# MVP Scope Freeze

## Decision

CareerOS AI MVP is frozen as an 8-12 week, one-developer product focused on acquiring the first 100 users. The MVP is a career intelligence and recommendation product with a simple AI career assistant. It is not an autonomous application agent, enterprise platform, browser agent, voice product, or multi-agent system.

## MVP Outcome

A user can:

1. Create an account.
2. Upload a resume.
3. Import or paste LinkedIn profile data.
4. Complete a guided career profile.
5. Receive an AI career analysis.
6. See a career dashboard.
7. Discover relevant jobs.
8. Receive job recommendations with explanations.
9. Ask a focused AI career assistant for guidance.
10. Receive learning recommendations.
11. Track applications manually.

This is enough to test whether users want an AI career operating system before building advanced automation.

## Scope Boundaries

### Included in MVP

- Authentication
- Profile ingestion
- Resume upload
- LinkedIn import
- Career analysis
- Job discovery
- Job recommendations
- Career dashboard
- AI career assistant
- Learning recommendations
- Application tracking

### Explicitly Excluded from MVP

- Autonomous applications
- Browser agents
- Multi-agent orchestration
- Knowledge graph
- Advanced automation
- Voice AI
- Recruiter simulation
- Salary negotiation
- Multi-tenant enterprise features
- Paid subscriptions
- Real-time market intelligence
- Calendar/email sending
- Automated external profile updates
- Job application form filling
- Company outreach automation

## Product Versioning

| Feature Area | MVP | V2 | V3 | Future Vision |
| --- | --- | --- | --- | --- |
| Authentication | Email and Google login | LinkedIn OAuth if approved | Phone login | Enterprise SSO |
| Profile ingestion | Resume upload, manual fields, LinkedIn paste/import | Better LinkedIn parser | Portfolio/GitHub import | Continuous profile sync |
| Resume processing | Parse and summarize resume | Resume improvement suggestions | Resume tailoring drafts | Automated version library |
| Career analysis | Strengths, gaps, readiness, next actions | Role comparison | Career path simulation | Autonomous career strategy |
| Job discovery | Curated/API job search | More sources | Company watchlists | Continuous global monitoring |
| Job recommendations | Rule-based match and AI explanation | Feedback-tuned ranking | ML ranking | Fully personalized opportunity agent |
| Dashboard | Career summary, actions, jobs, applications | Timeline and milestones | Motivation engine | Career command center OS |
| AI assistant | Single assistant, limited tools | More tools and context | Proactive task creation | Autonomous career operator |
| Learning recommendations | Skill gap to resource list | Learning plans | Progress tracking | Adaptive career learning coach |
| Application tracking | Manual tracker | Generated resume/cover letter drafts | Follow-up reminders | Supervised application automation |

## Feature Freeze Matrix

| Feature | Why It Exists | Business Value | Engineering Complexity | Can Be Deferred |
| --- | --- | --- | --- | --- |
| Authentication | Durable user profile and history | Required for retention and trust | Medium | No |
| Resume upload | Fastest way to ingest career context | Reduces onboarding friction | Medium | No |
| LinkedIn import | Users expect profile reuse | Improves profile completeness | Medium-high | Partially; paste/import can replace official API |
| Manual profile fields | Handles missing data and corrections | Improves analysis quality | Low-medium | No |
| Career analysis | First aha moment | Core activation event | Medium | No |
| Job discovery | Converts insight into opportunity | Core user value | Medium-high | No |
| Job recommendations | Makes jobs feel personalized | Differentiates from job boards | Medium | No |
| Dashboard | Main product surface | Drives repeat use | Medium | No |
| AI career assistant | Agent-first identity | Brand and UX differentiator | Medium | No |
| Learning recommendations | Helps users close gaps | Retention and long-term value | Low-medium | No |
| Application tracking | Keeps users returning | Practical utility | Low-medium | No |
| Resume tailoring | Strong value but not required for first test | Future premium path | Medium | Yes, V2 |
| Cover letters | Application support | Monetizable later | Medium | Yes, V2 |
| Market intelligence | Adds depth | Trust and insight | Medium | Yes, V2/V3 |
| Voice AI | Enhances persona | Novelty, accessibility | High | Yes, future |
| Browser agents | Enables automation | Powerful but risky | Very high | Yes, future |
| Multi-agent orchestration | Long-term autonomy | Scale of intelligence | Very high | Yes, future |
| Knowledge graph | Better reasoning | Strong long-term moat | High | Yes, future |
| Enterprise tenancy | B2B revenue | Later expansion | High | Yes, future |

## Success Criteria for First 100 Users

- 100 signed-up users.
- 70 percent complete profile onboarding.
- 60 percent receive a career analysis.
- 40 percent save or view at least 3 job recommendations.
- 30 percent create at least 1 application tracker item.
- 30 percent return within 7 days.
- Average career analysis usefulness rating of 4/5 or better.

## MVP Risk Level

Overall risk: Medium-high.

Primary risks:

- Job data access is harder than expected.
- LinkedIn official import is not available for MVP.
- Resume parsing quality is inconsistent.
- AI recommendations feel generic.
- One developer overbuilds infrastructure instead of shipping.

Mitigation:

- Support LinkedIn paste/upload fallback.
- Use one reliable job source or curated jobs at launch.
- Keep agent architecture small.
- Use deterministic scoring plus AI explanations.
- Defer all autonomous workflows.

