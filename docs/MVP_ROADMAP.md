# CareerOS MVP Roadmap

## MVP Goal

Build the first credible version of Scout — the agentic AI career operating system that IS CareerOS. The MVP should prove that users can onboard with Scout, receive honest and evidence-based career analysis, discover relevant opportunities through Scout's active monitoring, prepare applications, and see proactive AI-driven next actions.

The MVP does not attempt full autonomy. It establishes trust through explainable recommendations, user review, and controlled execution — while making the full vision of Scout completely clear.

## MVP Product Principles

- Scout is the entire product — not a feature bolted onto a dashboard.
- Career value and honest mentoring over feature breadth.
- Keep automation supervised and approval-gated.
- Make all recommendations explainable with evidence.
- Build memory from day one.
- Ground all market intelligence in real data, not static recommendations.
- Focus on workflows that feel meaningfully better than manual career management.
- Voice is Phase 2, not excluded from the vision.

## Phase 0: Foundation

Current phase.

Deliverables:

- Project documentation and product vision
- Scout persona and system design
- Architecture documentation
- Conceptual data model
- Integration landscape
- UX guidelines
- MVP roadmap and scope
- Authentication architecture (Better Auth, PostgreSQL, Drizzle)

Exit criteria:

- Clear product direction with Scout as the entire system.
- Clear initial modules.
- Clear non-goals.
- Technical stack confirmed and implemented at foundation level.

## Phase 1: Onboarding and Career Intelligence

Goal:

Create the first Scout user journey from account creation through niche validation to the first Career Intelligence Report.

Core features:

- Welcome experience and Scout introduction
- Authentication (Better Auth, email/password)
- Resume upload or manual profile entry
- LinkedIn data import or guided entry
- Profile discovery workflow
- Niche discovery: Scout asks exploratory questions about the user's goals and interests
- Niche validation: Scout validates the user's stated direction against market data — challenges it if the data does not support it
- Skills, experience, education, certifications, preferences, and goals capture
- AI-generated career summary grounded in evidence
- Strengths and weaknesses relative to target direction
- Missing skills and evidence gaps
- Opportunity score and market readiness score
- Initial growth recommendations with a prescribed system

Exit criteria:

- A user can create an account and be onboarded by Scout.
- Scout validates (or constructively challenges) the user's career niche.
- Scout produces a useful, evidence-grounded first career analysis.
- The user can edit incorrect profile facts.

## Phase 2: Career Command Center

Goal:

Create the main Scout operating surface where the user sees what Scout recommends and what needs their attention.

Core features:

- Scout action feed
- Priority next actions
- Career profile snapshot
- Progress indicators
- Agent task status
- Memory summary visible to the user
- User feedback on recommendations
- Voice interaction via Browser Web Speech API

Exit criteria:

- The user sees a clear next step after onboarding.
- Scout explains why each recommendation matters, with evidence.
- The user can speak to Scout and Scout can respond vocally.
- The user can accept, dismiss, or revise recommendations.

## Phase 3: Opportunity Discovery and Real-Time Intelligence

Goal:

Connect Scout to real-time data sources. Help users discover relevant opportunities continuously.

Core features:

- Real-time job source integration (one or more compliant APIs)
- Proactive 24x7 job monitoring — Scout watches the market even when the user is offline
- Opportunity ranking by fit, timing, and market signal
- Match scoring grounded in real job data
- Skill match and gap explanation per opportunity
- Graduate roles, internships, events, and meetups discovery
- Save and reject actions with preference learning
- Market intelligence signals from trusted third-party APIs
- Geo-political and economic context relevant to the user's field and location

Exit criteria:

- Scout actively discovers and surfaces opportunities without the user searching.
- Each opportunity includes a useful match explanation.
- Market signals update the user's career intelligence in real time.
- The system learns from saved and rejected opportunities.

## Phase 4: Application Workspace

Goal:

Turn saved opportunities into stronger, approval-gated applications.

Core features:

- Application tracker
- Tailored resume draft for each specific role
- Cover letter draft
- Recruiter message draft
- Interview preparation plan
- Deadlines and next actions
- Approval-required workflow — nothing is sent without explicit user review and consent

Exit criteria:

- A user can prepare a job application from a saved opportunity.
- Scout generates role-specific application assets.
- The user remains in complete control of every external action.

## Phase 5: Learning and Proof-of-Work

Goal:

Convert career gaps into practical learning progress and build visible proof of work.

Core features:

- Skill gap to learning plan conversion
- Course and certification recommendations
- Portfolio project and GitHub repo scaffolding
- Case study and proof-of-work prompts based on the user's career area
- Learning priorities tied to market demand signals
- Progress tracking linked to career readiness score

Exit criteria:

- The user can see which skills and evidence gaps matter most for their target direction.
- Scout provides a concrete learning plan tied to career goals.
- Scout suggests proof-of-work projects — not just courses.
- Progress updates improve career readiness score.

## Phase 6: Networking Intelligence

Goal:

Tell users who to meet, where, and why.

Core features:

- Networking targets tied to user goals and target roles
- Event discovery: conferences, meetups, online communities relevant to career stage
- Reasoning behind each networking recommendation
- Connection tracking and follow-up reminders

Exit criteria:

- The user receives specific, reasoned networking recommendations tied to their career direction.
- Relevant events and communities are surfaced proactively.

## Phase 7: Motivation and Momentum

Goal:

Help users sustain progress through a challenging career journey.

Core features:

- Career confidence score
- System adherence tracking (did the user follow the prescribed plan?)
- Progress milestones
- Encouraging but honest Scout feedback
- Momentum recovery when the user has stalled
- Small next action recommendations

Exit criteria:

- The user can see progress over time tied to real actions.
- Scout detects stalled momentum and proposes realistic recovery steps.

## MVP Non-Goals

- Fully autonomous job applications without approval.
- Full coverage of all job platforms on day one.
- Enterprise recruiting tools.
- Employer-facing marketplace.
- Complex analytics dashboards.
- Unreviewed external messaging.
- Production-scale automation before safety controls exist.

Note: Voice interaction is NOT a non-goal. It is Phase 2 and part of Scout's core identity.

## Success Metrics

Product metrics:

- Onboarding completion rate
- Niche validation engagement rate
- Career analysis usefulness rating
- Recommendation acceptance rate
- Saved opportunity rate
- Application assets generated
- Learning plan engagement
- User return frequency within 7 days

Quality metrics:

- Match explanation quality rating
- Resume tailoring quality rating
- User correction frequency (lower is better)
- Recommendation rejection reasons
- Scout response grounding quality (real data vs generic)
- Trust rating

## Roadmap Risks

- Real-time job API access may be more constrained than expected.
- LinkedIn profile access may be limited — manual import fallback required.
- Users may not trust market intelligence if Scout does not clearly cite sources.
- Career advice quality must be high — vague advice destroys the honest-mentor positioning.
- Sensitive user data requires strong privacy design.
- Overbuilding dashboards would weaken the Scout-first product identity.
