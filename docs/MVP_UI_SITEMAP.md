# MVP UI Sitemap

## Purpose

The MVP sitemap keeps the product small enough for one developer while establishing Fadi's identity as the entire CareerOS operating system — not a feature bolted onto a dashboard.

## Sitemap

```mermaid
flowchart TD
    Public[Public]
    Public --> Welcome[Welcome]
    Public --> Login[Login]
    Public --> Signup[Signup]

    App[Authenticated App — Fadi's Domain]
    App --> Onboarding[Onboarding]
    Onboarding --> Resume[Resume Upload]
    Onboarding --> LinkedIn[LinkedIn Import]
    Onboarding --> Profile[Profile Details]
    Onboarding --> Goals[Career Goals]
    Onboarding --> Niche[Niche Discovery and Validation]
    Onboarding --> Analysis[Career Analysis]

    App --> Dashboard[Fadi Command Center]
    Dashboard --> Assistant[Fadi Assistant]
    Dashboard --> Jobs[Job Recommendations]
    Dashboard --> Applications[Application Tracker]
    Dashboard --> Learning[Learning Recommendations]
    Dashboard --> Settings[Settings]
```

## Screens

### Public

- Welcome (Fadi introduction)
- Login
- Signup

### Onboarding

- Resume Upload
- LinkedIn Import
- Profile Details
- Career Goals
- Niche Discovery and Validation (Fadi validates the user's direction)
- Career Analysis Loading (with Fadi narration)
- Career Analysis Result

### Authenticated App

- Fadi Command Center (main operating surface)
- Fadi Assistant
- Job Recommendations
- Job Detail
- Application Tracker
- Application Detail
- Learning Recommendations
- Settings

## MVP Navigation

Primary navigation (Fadi's domains):

- Command Center
- Jobs
- Applications
- Learning
- Fadi (assistant)

Secondary navigation:

- Profile
- Settings
- Logout

## Phase 2 Additions

- Voice entry point (microphone button) in Fadi Command Center and Fadi Assistant.
- Market Intelligence Hub (once real-time data sources are integrated).

## Excluded Screens in Phase 1

- Market Intelligence Hub (Phase 3)
- AI Agent Workspace (future)
- Enterprise admin
- Billing and subscription management
- Recruiter simulation
- Salary negotiation
- Browser automation console
- Knowledge graph explorer
- Networking Intelligence Hub (Phase 6)
- Proof-of-Work Hub (Phase 5)

## UX Priority

The first screen after onboarding must be the Fadi Command Center, not a generic chat page. Fadi is present across every screen, but the command center carries the operating system identity through its action feed, analysis summary, job recommendations, learning path, and application tracker.

Voice must be designable in Phase 1 even if not implemented: no UI pattern should structurally prevent voice from being added in Phase 2.
