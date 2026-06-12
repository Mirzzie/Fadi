# MVP Screen Flow

## End-to-End Flow

```mermaid
flowchart TD
    Welcome[Welcome] --> Auth[Sign In or Sign Up]
    Auth --> Check{Onboarding Complete?}
    Check -->|No| Resume[Resume Upload]
    Check -->|Yes| Dashboard[Scout Command Center]
    Resume --> LinkedIn[LinkedIn Import]
    LinkedIn --> Profile[Profile Details]
    Profile --> Goals[Career Goals]
    Goals --> Niche[Niche Discovery]
    Niche --> Validate[Scout Niche Validation]
    Validate --> Generate[Generate Career Analysis]
    Generate --> Analysis[Analysis Result]
    Analysis --> Dashboard
    Dashboard --> Jobs[Job Recommendations]
    Dashboard --> Apps[Application Tracker]
    Dashboard --> Learning[Learning Recommendations]
    Dashboard --> Assistant[Scout Assistant]
    Jobs --> JobDetail[Job Detail]
    JobDetail --> Save[Save Job]
    Save --> CreateApp[Create Application]
    CreateApp --> Apps
```

## Screen Details

### Welcome

Purpose:

- Introduce Scout as the career operating system in one screen.
- Move the user to sign up.

MVP content:

- Scout introduction in first person.
- Three specific value statements (honest mentoring, proactive discovery, evidence-based guidance).
- Sign up / log in CTA.

### Resume Upload

Purpose:

- Capture career data quickly.

States:

- Empty
- Uploading
- Parsing
- Parsed with extraction preview
- Parse failed with fallback option

### LinkedIn Import

Purpose:

- Add public professional positioning context.

MVP behavior:

- User can paste LinkedIn profile text.
- User can enter LinkedIn URL for reference.
- Official API import is deferred unless easily approved.

Scout says: "LinkedIn helps me understand how you present yourself publicly. If direct import is unavailable, paste your profile text here and I will still use it."

### Profile Details

Purpose:

- Let the user confirm and correct Scout's inferences.

Fields:

- Name
- Current title
- Current company
- Location
- Target role
- Industries
- Remote preference
- Salary expectation
- Skills

### Career Goals

Purpose:

- Focus Scout's analysis and niche validation.

Fields:

- Main goal
- Target role
- Preferred locations
- Career stage
- Timeline
- Constraints

### Niche Discovery and Validation

Purpose:

- Scout asks about the user's direction and validates it honestly against available data.

Flow:

1. Scout asks exploratory questions about the user's goals and interests.
2. User states or confirms a direction.
3. Scout validates the direction against available market data.
4. Scout returns an honest assessment: supported, challenged, or redirected with evidence.
5. User can accept Scout's assessment, push back, or revise their direction.

States:

- Scout asking questions
- User providing direction
- Scout validating (processing)
- Validation result (supported / challenged / redirect)
- User confirms or revises

### Analysis Generation

Purpose:

- Maintain trust during the generation wait.

Scout narrates each step:

- Reading your CV.
- Comparing LinkedIn context.
- Mapping your skills.
- Checking target role fit.
- Reviewing available market signals.
- Identifying evidence gaps.
- Preparing your career system.

### Career Analysis Result

Purpose:

- Deliver first major Scout value moment: the honest, evidence-grounded career intelligence report.

Sections:

- Scout summary card with niche assessment
- Career readiness score with component breakdown
- Resume quality score with component breakdown
- Strengths (with evidence)
- Skill and evidence gaps (constructive)
- Career opportunities (best-fit, stretch, adjacent)
- Market demand signals with source attribution
- Learning path (market demand prioritized)
- Recommended career system: what to do, in what order

### Scout Command Center (Dashboard)

Purpose:

- Main operating screen for the user. Scout's primary surface.

Sections:

- Scout action feed: what Scout has prepared, found, or surfaced
- Career readiness snapshot
- Priority next actions with reasoning
- Top job recommendations
- Application tracker summary
- Learning recommendations
- Market signal updates
- Scout assistant entry point

### Job Recommendations

Purpose:

- Show Scout-curated, personalized opportunities.

Sections:

- Filters (role, location, remote preference)
- Recommendation cards with match score and explanation
- Skill matches and gaps per role
- Salary and location fit
- Save and reject actions

### Application Tracker

Purpose:

- Track applications manually with Scout's assistance.

Sections:

- Status columns or list view
- Application detail
- Notes and next action
- Generated assets (resume draft, cover letter) — Phase 2

### Scout Assistant

Purpose:

- Answer grounded career questions including challenging and contrarian ones.

Scout is present, honest, and evidence-backed. It will challenge assumptions if data warrants it.

Capabilities:

- Answer career, resume, job targeting, learning, niche, and application tracking questions.
- Push back on decisions the data does not support.
- Suggest specific next actions inside CareerOS.

Phase 1 boundaries:

- No external actions from the assistant.
- No autonomous workflow execution.
- No recruiter simulation.

## Phase 2 Additions

- Voice entry point visible in the Scout command center and assistant.
- "Speak to Scout" button that activates Browser Web Speech API.
- Voice responses from Scout alongside text.
