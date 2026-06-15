# MVP Scope Freeze

## Decision

CareerOS MVP is an 8-12 week, one-developer product focused on acquiring the first 100 users. The MVP expresses Fadi's full identity as an honest career mentor and career operating system, but scopes the features to what is buildable by one developer in that window.

The MVP is NOT a toy version of CareerOS. It IS the minimum set of features that let Fadi's real personality come through: honest niche guidance, evidence-based analysis, proactive job matching, and a prescribed career system.

## MVP Outcome

A user can:

1. Create an account.
2. Upload a resume or enter profile data manually.
3. Import or paste LinkedIn profile data.
4. Complete a guided career profile.
5. Have Fadi validate and (where warranted) challenge their stated career direction using available market data.
6. Receive an honest, evidence-grounded AI career analysis.
7. See a career command center driven by Fadi.
8. Discover relevant jobs matched to their profile.
9. Receive job recommendations with match explanations.
10. Ask Fadi grounded career questions, including challenging ones.
11. Receive learning recommendations prioritized by market demand.
12. Track applications manually.

This is enough to validate whether users trust an honest, proactive AI career operating system before building full autonomy.

## Scope Boundaries

### Included in MVP

- Authentication (Better Auth, email/password)
- Profile ingestion (resume, LinkedIn, manual)
- Niche discovery and basic niche validation (with available market data)
- Career analysis with honest gap assessment
- Job discovery and matching
- Job recommendations with explanations
- Career command center (Fadi as the operating surface)
- Career assistant (Fadi answers grounded career questions)
- Learning recommendations (market-demand prioritized)
- Application tracking

### Explicitly Excluded from MVP

- Autonomous applications without approval
- Browser agents
- Full multi-agent orchestration
- Full knowledge graph
- Advanced automation
- Voice interaction — Phase 2 (core to Fadi's identity but not Phase 1)
- Recruiter simulation
- Salary negotiation
- Multi-tenant enterprise features
- Paid subscriptions
- Full real-time market intelligence API integration — Phase 3
- Calendar or email sending
- Automated external profile updates
- Job application form filling
- Company outreach automation
- Proof-of-work project scaffolding — Phase 5
- Networking intelligence — Phase 6
- Live geo-political signal monitoring — Phase 3+

Note on Voice: Voice is NOT "future maybe." Voice is Phase 2. Every design decision should assume voice is coming. Do not build UI patterns that would be broken by voice.

Note on Real-Time Market Data: Phase 1 MVP uses available directional data (curated job data, static market context) for niche validation. Phase 3 wires in live third-party APIs. The niche validation and honest-mentor behavior must still exist in Phase 1 — just with the data sources scoped appropriately.

## Product Versioning

| Feature Area | Phase 1 MVP | Phase 2 | Phase 3 | Full Vision |
| --- | --- | --- | --- | --- |
| Authentication | Email/password (Better Auth) | OAuth providers | Phone login | Enterprise SSO |
| Profile ingestion | Resume upload, manual, LinkedIn paste | Better LinkedIn import | Portfolio/GitHub import | Continuous profile sync |
| Niche validation | Directional, curated data | Live market data | Geo-political context | Continuous revalidation |
| Career analysis | Honest gap analysis, readiness scores | Role comparison | Career path simulation | Autonomous career strategy |
| Job discovery | One compliant API or curated source | More sources | Real-time monitoring | 24x7 global discovery |
| Job recommendations | Rule-based match + explanation | Feedback-tuned ranking | ML ranking | Personalized opportunity agent |
| Voice interaction | Not included | Browser Web Speech API | Full voice command | Ambient career assistant |
| Dashboard | Fadi command center | Timeline and milestones | Motivation engine | Full career operating system |
| Fadi assistant | Single agent, limited tools | More tools and context | Proactive task creation | Autonomous career operator |
| Learning | Skill gap to resource list | Learning plans + proof-of-work | Progress tracking | Adaptive career learning coach |
| Application tracking | Manual tracker | Generated resume/cover letter | Follow-up automation | Supervised application automation |
| Market intelligence | Directional signals | Real-time APIs | Geo-political context | Predictive signals |
| Networking | Not included | WHO to meet and WHY | Event discovery | Full networking intelligence |

## Feature Freeze Matrix

| Feature | Why It Exists | Business Value | Engineering Complexity | Can Be Deferred |
| --- | --- | --- | --- | --- |
| Authentication | Durable user identity | Required for trust and retention | Medium | No |
| Resume upload | Fast career context ingestion | Reduces onboarding friction | Medium | No |
| LinkedIn import | Users expect profile reuse | Improves analysis quality | Medium-high | Partially |
| Manual profile fields | Handles missing data and corrections | Improves analysis quality | Low-medium | No |
| Niche validation | Core of Fadi's honest mentor identity | Trust and differentiation | Medium | No |
| Career analysis | First Fadi value moment | Core activation | Medium | No |
| Job discovery | Converts insight into opportunity | Core user value | Medium-high | No |
| Job recommendations | Makes jobs feel personally relevant | Differentiates from job boards | Medium | No |
| Dashboard (Fadi command center) | Fadi's primary operating surface | Drives repeat use | Medium | No |
| Fadi career assistant | Expresses Fadi's full identity | Brand and UX differentiator | Medium | No |
| Learning recommendations | Helps users close gaps | Retention and long-term value | Low-medium | No |
| Application tracking | Keeps users returning | Practical utility | Low-medium | No |
| Resume tailoring | Strong value but not blocking | Future premium path | Medium | Yes, Phase 2 |
| Cover letters | Application support | Monetizable | Medium | Yes, Phase 2 |
| Voice interaction | Core to Fadi's identity | Natural interaction + accessibility | High | Yes, Phase 2 |
| Real-time market APIs | Grounds market intelligence | Trust and depth | Medium | Yes, Phase 3 |
| Browser agents | Enables automation | Powerful but high-risk | Very high | Yes, future |
| Multi-agent orchestration | Long-term autonomy | Scale of intelligence | Very high | Yes, future |
| Knowledge graph | Better reasoning | Long-term moat | High | Yes, future |
| Enterprise tenancy | B2B revenue | Later expansion | High | Yes, future |
| Networking intelligence | Strategic career growth | High value | Medium | Yes, Phase 6 |
| Proof-of-work scaffolding | Builds visible career evidence | High value | Medium | Yes, Phase 5 |

## Success Criteria for First 100 Users

- 100 signed-up users.
- 70% complete profile onboarding.
- 60% receive a career analysis.
- 50% engage with Fadi's niche validation (agree, challenge, or revise direction).
- 40% save or view at least 3 job recommendations.
- 30% create at least 1 application tracker item.
- 30% return within 7 days.
- Average career analysis usefulness rating of 4/5 or better.
- At least one user says something like "Fadi told me something I needed to hear but didn't expect."

## MVP Risk Level

Overall risk: Medium-high.

Primary risks:

- Job data access is harder than expected.
- LinkedIn official import is not available for MVP.
- Resume parsing quality is inconsistent.
- Niche validation feels too cautious or too harsh — calibration required.
- One developer overbuilds infrastructure instead of shipping.

Mitigation:

- Support LinkedIn paste/upload fallback.
- Use one reliable job source or curated jobs at launch.
- Keep agent architecture small.
- Use deterministic scoring plus AI explanations.
- Defer full autonomous workflows to Phase 3+.
- Calibrate niche validation tone against real user feedback.
