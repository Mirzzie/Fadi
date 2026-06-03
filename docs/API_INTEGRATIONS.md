# CareerOS API Integrations

## Purpose

CareerOS depends on integrations for identity, profile discovery, opportunity discovery, market intelligence, documents, communication, scheduling, and learning recommendations. This document defines the integration landscape and the review requirements before any integration is implemented.

No integration should be implemented before legal, product, and technical review of provider terms, data permissions, and user consent requirements.

## Integration Principles

- Use official APIs where available.
- Request the minimum permissions needed.
- Make user consent explicit.
- Store integration tokens securely.
- Keep audit logs for external actions.
- Approval-gate every external action — never submit applications, send messages, or update external profiles without explicit user consent.
- Never scrape without full legal and platform policy review.
- All source attribution must be stored and displayed with market intelligence data.

## Authentication Providers

Current (Phase 1):

- Better Auth — email/password

Future additions:

- LinkedIn (OAuth)
- Google (OAuth)
- Phone number
- Enterprise SSO

## Profile Discovery Integrations

Potential profile sources:

- LinkedIn profile data (official API or pasted/imported text)
- Resume upload (PDF, DOCX)
- Manual profile input
- GitHub profile and repositories
- Public portfolio URLs

Key constraints:

- LinkedIn data access may be limited by API permissions — paste/import fallback required.
- Resume parsing must handle sensitive personal data carefully.
- Imported data must never be treated as final without user review.

## Job Discovery Integrations

Potential sources:

- LinkedIn Jobs
- Indeed
- IrishJobs
- Glassdoor
- Wellfound
- Reed
- TotalJobs
- EURES
- Company career pages
- Partner or aggregator APIs

Required capabilities:

- Search jobs by role, skill, location, salary, remote mode, and seniority.
- Normalize and deduplicate job descriptions.
- Monitor new opportunities continuously (background workers).
- Store source URLs and attribution.
- Track deadlines and application links.
- Remove stale or closed postings.

Phase 3+ integration — Phase 1 uses curated seeded jobs.

## AI and Model Integrations

CareerOS uses a pluggable model gateway. All AI calls route through this abstraction. No feature code imports provider SDKs directly.

Currently wired:

- OpenAI SDK (GPT-4.1-mini and equivalents)

Supported by design (swap at model gateway layer):

- Anthropic Claude
- Google Gemini
- Local models
- Future agentic entities

The model gateway provides routing, fallback, cost controls, rate limits, and evaluation fixtures.

## Market Intelligence Integrations

Sources for trusted market data:

- Government labor statistics (CSO, ONS, BLS, Eurostat)
- Economic indicators
- Licensed salary datasets
- Industry reports and publications
- Trusted news feeds
- Company announcements and hiring signals
- Layoff tracking datasets (where legally usable)
- Geo-political context APIs

Required capabilities:

- Monitor hiring trends by role, sector, and geography.
- Track salary intelligence by seniority and geography.
- Summarize industry changes and emerging skill demand.
- Detect layoff and hiring signals.
- Provide geo-political context relevant to career sectors.
- Connect signals to specific user goals.

Every market intelligence output must include source attribution, publication date, and confidence level.

Phase 3+ integration — Phase 1 uses directional curated data.

## Application Automation Integrations

Potential integration areas:

- Document rendering (PDF, DOCX export)
- Email providers (approval-gated message sending)
- Calendar providers (approval-gated scheduling)
- Job application platforms (browser-assisted form preparation — future, high-risk, full safety review required)

Approval boundaries:

- Drafting: allowed without approval.
- Sending: never allowed without explicit user approval.
- Scheduling: never allowed without explicit user approval.

## Learning Integrations

Potential sources:

- Course platforms (Coursera, Udemy, LinkedIn Learning, etc.)
- Certification providers
- Public learning resources (free alternatives)
- GitHub as proof-of-work scaffolding platform

Required capabilities:

- Recommend learning resources by skill gap and market demand.
- Distinguish high-certificate-value vs high-portfolio-value roles.
- Track progress.
- Recommend free and paid alternatives.

## Integration Readiness Checklist

Before enabling any integration:

- Terms of service reviewed and approved.
- User consent model defined.
- Data storage requirements documented.
- Token handling approach defined.
- Rate limits understood.
- Error handling planned.
- Audit logs designed.
- User disconnect and deletion flows defined.
- Source attribution stored for all market data.
