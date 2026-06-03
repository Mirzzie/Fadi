# MVP Feature Matrix

## Feature Classification

| Feature | Version | Why It Exists | Business Value | Complexity | Deferred? |
| --- | --- | --- | --- | --- | --- |
| Email authentication (Better Auth) | Phase 1 | Account creation and persistence | Required for retention | Medium | No |
| Resume upload | Phase 1 | Fast career context ingestion | Activation | Medium | No |
| Resume parsing | Phase 1 | Convert document into profile data | Core analysis input | Medium | No |
| LinkedIn paste/import | Phase 1 | Reuse existing professional profile | Better onboarding | Medium | No |
| Official LinkedIn API import | Phase 2 | Cleaner import if access approved | Better UX | High | Yes |
| OAuth providers (Google, etc.) | Phase 2 | Lower signup friction | Higher conversion | Medium | Yes |
| Manual profile editor | Phase 1 | Correct imported data | Trust and accuracy | Low-medium | No |
| Career goals form | Phase 1 | Focus recommendations | Personalization | Low | No |
| Niche discovery conversation | Phase 1 | Core of Kai's honest-mentor identity | Trust and differentiation | Medium | No |
| Niche validation (directional data) | Phase 1 | Validates vs. challenges direction with evidence | Core Kai identity | Medium | No |
| Niche validation (real-time APIs) | Phase 3 | Live market validation | Depth and accuracy | Medium-high | Yes |
| Career analysis | Phase 1 | First major Kai value moment | Activation and differentiation | Medium | No |
| Readiness score | Phase 1 | Summarize career state | Easy comprehension | Low-medium | No |
| Skill gap analysis | Phase 1 | Identify improvement path | Learning and jobs linkage | Medium | No |
| Career command center | Phase 1 | Main Kai operating surface | Retention and identity | Medium | No |
| Kai career assistant | Phase 1 | Expresses Kai's full identity | Brand and UX differentiator | Medium | No |
| Job search | Phase 1 | Find opportunities | Core utility | Medium | No |
| Job recommendations | Phase 1 | Personalize opportunity discovery | Core value | Medium | No |
| Job match explanations | Phase 1 | Build trust | Differentiation | Medium | No |
| Save and reject jobs | Phase 1 | Capture preference feedback | Recommendation improvement | Low | No |
| Application tracker | Phase 1 | Practical workflow utility | Retention | Low-medium | No |
| Learning recommendations (market prioritized) | Phase 1 | Close skill gaps tied to demand | Long-term retention | Low-medium | No |
| Application notes | Phase 1 | Keeps tracker useful | Retention | Low | No |
| Resume tailoring | Phase 2 | Improve applications | Premium value | Medium | Yes |
| Cover letter generation | Phase 2 | Improve applications | Premium value | Medium | Yes |
| Voice interaction (Browser Web Speech API) | Phase 2 | Core to Kai's identity | Natural interaction + accessibility | High | Yes (Phase 2, not excluded) |
| Proof-of-work scaffolding | Phase 5 | Build visible career evidence | High value | Medium | Yes |
| Networking intelligence | Phase 6 | Strategic career growth | High value | Medium | Yes |
| Market intelligence (real-time) | Phase 3 | Real current market context | Trust and depth | Medium | Yes |
| Geo-political signal monitoring | Phase 3 | Grounds niche validation in global context | Accuracy | Medium-high | Yes |
| Follow-up reminders | Phase 2 | Improve application process | Retention | Low-medium | Yes |
| Document export | Phase 2 | Practical output | Utility | Medium | Yes |
| Learning progress tracking | Phase 2 | Increase engagement | Retention | Low-medium | Yes |
| Subscription billing | Phase 2 | Monetization | Revenue | Medium | Yes |
| Advanced job source integrations | Phase 3 | Better coverage | Growth | High | Yes |
| ML recommendation ranking | Phase 3 | Better personalization | Retention at scale | High | Yes |
| Browser agent | Future | Automate applications | Major long-term differentiation | Very high | Yes |
| Multi-agent orchestration | Future | Autonomous operating system | Long-term moat | Very high | Yes |
| Knowledge graph | Future | Deep career intelligence | Long-term moat | High | Yes |
| Recruiter simulation | Future | Interview practice | Premium feature | High | Yes |
| Salary negotiation | Future | High-value coaching | Premium feature | High | Yes |
| Enterprise multi-tenancy | Future | B2B revenue | Expansion | High | Yes |

## MVP Acceptance Definition

Phase 1 MVP is complete only when:

- A user can complete onboarding with Kai guiding the process.
- A resume can be uploaded and parsed.
- LinkedIn data can be pasted or imported to improve the profile.
- Niche discovery and basic niche validation work: Kai gives an honest, evidence-referenced assessment.
- Career analysis generates useful, editable, honest insights.
- Jobs can be discovered and recommended with match explanations.
- The Kai command center makes the next action obvious.
- The Kai assistant answers grounded career questions, including challenging ones.
- Learning recommendations exist and are tied to market demand.
- Applications can be tracked manually.

## Deferred Feature Rule

Any feature that does not directly help the first 100 users experience Kai's honest-mentor identity, complete onboarding, understand their career state, find jobs, or track applications is deferred.

Voice is not excluded from the vision — it is Phase 2 and core to Kai's identity. All UI design should be compatible with voice being added in Phase 2.
