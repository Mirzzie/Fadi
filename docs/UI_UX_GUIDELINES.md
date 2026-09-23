# Fadi UI and UX guidelines

**Status:** Current product standard

**Updated:** 23 September 2026

Fadi should feel like one calm assistant guiding one career journey. A page is successful when the person understands the state, the next action, and its consequence without learning the platform's internal architecture.

## Four destinations

Use the navigation source in `apps/web/src/components/os/navigation.ts`:

| Destination | User question | Areas |
|---|---|---|
| Today | What matters now? | Today, full picture, career report |
| Opportunities | Where can I go and what is happening? | Roles, applications, people |
| Practice | What should I learn, build, or rehearse? | Learning, interview practice |
| My career | What is true about me and what do I share? | Record, documents, portfolio, directions |

Profile and Settings belong to the account menu. Machines, permissions, provider health, audit events, and raw logs are contextual or advanced controls, not primary destinations.

## Page hierarchy

Every primary page should present, in this order:

1. the current goal or object;
2. its state in plain language;
3. one primary next action;
4. decisions that block progress;
5. optional explanation and advanced controls.

Use progressive disclosure. Do not present every engine, data source, recommendation type, or machine action as a peer.

## Today

Today is the operating surface, not an analytics dashboard. It shows:

- what the person is working toward;
- the next executable step;
- recent consequential work by Fadi;
- decisions waiting for the person;
- no more than three grounded suggestions.

Empty sections explain the next useful setup action. They do not fill space with zero metrics.

## Apply and Prepare

Apply and Prepare describe the phase of a goal. They may reorder recommendations or change the next action. They must not hide routes, records, documents, or capabilities. A person can move between discovering, preparing, applying, interviewing, and following up without losing context.

## Practice and labs

Practice should expose three concepts:

- **Now** — the current activity and next step;
- **Plan** — queued work and why it matters;
- **Completed** — verified outcomes and what they produced.

A machine appears inside the project as **Environment**. Global machine inventory, grants, and raw action history belong under advanced administration.

When Fadi can observe an environment, the primary control is **Check and continue**. Manual result text, pasted terminal output, and manual verification are fallbacks for external environments.

A commitment has one finish line. A generated practical project completes through its run; an external course or activity uses a compact completion review. Both call the same outcome service.

## Completion

Completion asks one question first: **Is this an accurate record of what you completed?**

After approval, show one completion package with optional downstream proposals: career record, portfolio placement, résumé wording, interview story, and public campaign. Each proposal has Accept or Skip. Do not send the person through five pages to repeat the same facts.

Media is optional. Say “Add proof” when useful; never show “no evidence” as a public placeholder.

## Interview practice

When launched from an application, prefill the job, role, employer, description, direction, region, and seniority. The default setup asks only:

- interview stage;
- 10 or 20 minutes;
- **Start talking**.

Put overrides under “Change context.” Use competencies and behavioral anchors rather than an ungrounded decimal score. If no career story matches, say so and create a preparation step; never return an irrelevant story as the strongest match.

Call transcript-only measures “answer length and filler words.” Reserve delivery coaching for measured audio duration, rate, pauses, and interruptions. Do not grade accent conformity.

## Fadi presence and voice

Fadi is available from every destination and carries the active work context. The UI always shows one of these states when relevant: idle, listening, thinking, speaking, acting, waiting for approval, blocked, or offline.

- Listening is visible and user-initiated.
- The transcript is visible and editable before a consequential interpretation.
- The person can interrupt speech.
- Voice, chat, and buttons continue the same thread.
- An action confirmation names the object, effect, target, and reversal when available.

The orb can signal presence; it must not be the only way to discover pending work or approvals.

## Choices and language

- Prefer one recommended action plus a secondary alternative.
- Replace internal nouns with the person's language: “Environment,” not hypervisor inventory; “What Fadi did,” not execution ledger.
- Explain why a recommendation matters to the active goal.
- Use labels that remain visible. Do not rely on hover to identify navigation.
- Avoid fake precision, celebratory friction, and gamification that scores outcomes outside the person's control.
- Keep destructive controls available, clearly scoped, and separated from routine actions.

## Accessibility and responsive behavior

- Every action works by keyboard and has a visible focus state.
- Icon-only controls have accessible names; primary navigation includes visible text.
- Do not use color as the only status signal.
- Announce asynchronous status and validation with appropriate live regions.
- Respect reduced motion and system contrast preferences.
- At narrow widths, preserve the goal, state, primary action, and Fadi status before secondary detail.

## Retired patterns

Do not reintroduce:

- ten equal dock icons;
- mode switches that hide sections;
- nested page tabs inside destination tabs;
- separate completion flows for the same work;
- a settings page presented as a dashboard;
- approvals visible only on one route;
- audit logs as the main user experience;
- raw Auto/Include/Exclude controls on every card by default;
- provider or infrastructure choices before a task requires them;
- duplicate forms asking for context Fadi already owns.
