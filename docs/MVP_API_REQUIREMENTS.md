# MVP API Requirements

## Purpose

This document defines the API surface required for MVP. The API should be small, product-driven, and implementable by one developer.

## API Style

Use Next.js Route Handlers and Server Actions for MVP. Keep endpoint behavior explicit and typed. Avoid building a broad public API until product workflows stabilize.

## Authentication

All authenticated routes require Supabase Auth session.

Public routes:

- Landing page
- Signup/login pages

Authenticated routes:

- Profile
- Resume upload
- Career analysis
- Job search
- Recommendations
- Applications
- Learning recommendations
- Assistant

## Endpoint Requirements

### Profile

- `GET /api/profile`: return current profile.
- `POST /api/profile`: create or update profile fields.
- `POST /api/profile/linkedin`: save LinkedIn pasted/imported data and parse profile summary.

### Resume

- `POST /api/resume/upload`: upload resume to storage and create resume record.
- `POST /api/resume/:id/parse`: parse resume text and update resume record.
- `GET /api/resume/current`: return current resume summary.

### Career Analysis

- `POST /api/career-analysis`: generate analysis from profile, resume, LinkedIn data, and goals.
- `GET /api/career-analysis/latest`: return latest analysis.

### Jobs

- `GET /api/jobs/search`: search jobs by role, location, and remote preference.
- `POST /api/jobs/recommend`: generate recommendations for current user.
- `GET /api/jobs/recommendations`: list recommendations.
- `POST /api/jobs/:id/save`: save recommendation.
- `POST /api/jobs/:id/reject`: reject recommendation.

### Applications

- `GET /api/applications`: list tracked applications.
- `POST /api/applications`: create application.
- `PATCH /api/applications/:id`: update status, notes, next action, deadline.
- `DELETE /api/applications/:id`: delete application.

### Learning

- `POST /api/learning/recommend`: generate learning recommendations from skill gaps.
- `GET /api/learning`: list recommendations.
- `PATCH /api/learning/:id`: update status.

### Assistant

- `POST /api/assistant/message`: send message and receive grounded assistant response.
- `GET /api/assistant/messages`: list recent messages.

### Events

- `POST /api/events`: record product event.

## MVP API Flow

```mermaid
flowchart TD
    Auth[Auth Session] --> Profile[Profile API]
    Profile --> Resume[Resume API]
    Resume --> Analysis[Career Analysis API]
    Analysis --> Jobs[Job Recommendation API]
    Analysis --> Learning[Learning API]
    Jobs --> Applications[Application API]
    Profile --> Assistant[Assistant API]
    Analysis --> Assistant
```

## AI API Requirements

AI calls must:

- Use prompt versions.
- Log model name and approximate usage.
- Include only necessary user context.
- Return structured JSON where possible.
- Validate output before storing.
- Fail gracefully with retry option.

## Error Handling

API responses should distinguish:

- Authentication errors
- Validation errors
- Missing profile data
- AI generation errors
- Job source errors
- File parsing errors
- Database errors

## Excluded API Capabilities

- External job application submission.
- Message sending.
- Calendar scheduling.
- Browser automation.
- Enterprise admin endpoints.
- Billing endpoints.
- Public developer API.

