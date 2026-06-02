# CareerOS AI API Integrations

## Purpose

CareerOS AI depends on integrations for identity, profile discovery, opportunity discovery, market intelligence, documents, communication, scheduling, and learning recommendations. This document defines the initial integration landscape and the questions that must be resolved before implementation.

No integrations should be implemented before legal, product, and technical review of provider terms, data permissions, and user consent requirements.

## Integration Principles

- Use official APIs where available.
- Request the minimum permissions needed.
- Make user consent explicit.
- Store integration tokens securely.
- Keep audit logs for external actions.
- Do not submit applications, send messages, or update external profiles without approval.
- Avoid scraping strategies until platform policies and compliance implications are reviewed.

## Authentication Providers

Initial options from the brief:

- LinkedIn
- Google
- Email
- Phone number

Required capabilities:

- Account creation
- Login
- Account linking
- Session management
- Secure logout
- Account deletion support

Open decisions:

- Whether LinkedIn authentication is available and sufficient for profile import.
- Whether phone number authentication is needed for MVP.
- Whether enterprise SSO should be considered later.

## Profile Discovery Integrations

Potential profile sources:

- LinkedIn profile data
- Resume upload
- Manual profile input
- Public portfolio or website URLs

Required capabilities:

- Import profile facts.
- Parse resume content.
- Normalize skills, roles, education, and certifications.
- Detect missing profile data.
- Let users review and correct imported facts.

Key constraints:

- LinkedIn data access may be limited by API permissions.
- Resume parsing must handle sensitive personal data carefully.
- Imported data should never be treated as final without user review.

## Job Discovery Integrations

Potential sources from the brief:

- LinkedIn Jobs
- Indeed
- IrishJobs
- Glassdoor
- Wellfound
- Reed
- TotalJobs
- EURES
- Company career pages

Required capabilities:

- Search jobs by role, skill, location, salary, remote mode, and seniority.
- Normalize job descriptions.
- Detect duplicate postings.
- Monitor new opportunities.
- Store source URLs and attribution.
- Track deadlines and application links.

Open decisions:

- Which sources provide official APIs.
- Which sources permit automated access.
- Whether a third-party jobs aggregation API is needed.
- How often each source can be checked.
- How to handle stale or closed jobs.

## Application Automation Integrations

Potential integration areas:

- Resume generation and export
- Cover letter generation and export
- Application tracking
- Email drafts
- Calendar reminders
- Form preparation

Required capabilities:

- Generate application documents.
- Export documents in common formats.
- Track application stages.
- Create reminders for deadlines and interviews.
- Prepare messages for recruiters or hiring managers.

High-risk actions requiring approval:

- Submitting a job application.
- Sending an email or message.
- Uploading a resume to an external site.
- Updating a LinkedIn or external profile.
- Scheduling an interview.

## Learning Integrations

Potential sources:

- Course platforms
- Certification providers
- Public learning resources
- Internal curated content

Required capabilities:

- Recommend learning resources based on skill gaps.
- Map courses to target roles and missing skills.
- Track progress.
- Prioritize high-return learning actions.

Open decisions:

- Which learning providers should be used in MVP.
- Whether affiliate relationships affect recommendation neutrality.
- How to rank free versus paid learning options.

## Market Intelligence Integrations

Potential sources from the brief:

- Government reports
- Labor statistics
- Industry reports
- News feeds
- Economic indicators

Required capabilities:

- Monitor hiring trends.
- Track salary intelligence.
- Summarize industry changes.
- Detect layoff and hiring signals.
- Track skill demand.
- Connect market signals to user goals.

Important requirement:

Market intelligence must be presented with source attribution, dates, and uncertainty. Users should be able to distinguish current signals from older trend data.

## Communication and Scheduling Integrations

Potential sources:

- Email providers
- Calendar providers
- Notification services

Required capabilities:

- Draft messages.
- Create reminders.
- Track deadlines.
- Prepare interview schedules.
- Notify users about urgent actions.

Approval boundaries:

- Drafting is allowed without approval.
- Sending is not allowed without explicit approval.
- Scheduling is not allowed without explicit approval.

## AI and Model Integrations

The product will require AI models for:

- Conversation
- Career analysis
- Resume and cover letter generation
- Job matching
- Market summarization
- Skill mapping
- Planning
- Tool orchestration
- Voice interaction

Future decisions:

- Model provider
- Model routing strategy
- Evaluation framework
- Cost controls
- Prompt and memory privacy
- Safety review process
- Human review triggers

## Integration Readiness Checklist

Before enabling any integration:

- Terms of service reviewed.
- User consent model defined.
- Data storage requirements documented.
- Token handling approach defined.
- Rate limits understood.
- Error handling planned.
- Audit logs designed.
- User disconnect and deletion flows defined.

