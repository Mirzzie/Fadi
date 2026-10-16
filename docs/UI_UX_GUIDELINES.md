# Fadi UI and UX guidelines

**Status:** Current product standard

**Updated:** 16 October 2026

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

## Interaction budget and replacement rule

Adding a capability does not justify adding a permanent control. The default surface for one
task has this budget:

- one clear state;
- one recommended action;
- at most one secondary choice when the choice changes the outcome;
- one compact status line for the environment;
- details, commands, logs, provenance and administration disclosed on request.

If Fadi already owns the data, can observe the result, or has an approved execution channel, it
must not ask the person to re-enter, copy, paste, relay, or manually confirm that information.
The normal action sequence is: observe automatically; propose a consequential change; obtain one
scoped approval when required; execute; verify; record a receipt. A manual path is a fallback for
an external environment, a deliberate learning mode, or an authority boundary such as `sudo`.

Every change that introduces a visible feature must name the existing surface it replaces,
merges, moves under Details, or removes. Adding a new card above the old cards is incomplete work.
If no surface can be retired, the change needs evidence that the new control represents a distinct
user decision. Pull requests and handoffs must include a **surface delta**: controls added,
controls removed, and the final number of primary actions.

One object has one authoritative state and one conductor. Different views may project that state,
but they must not own separate polling, readiness, approval, or completion logic. An approval is
rendered at the point of action from the shared approval record; the global inbox is another view
of that record, not a second journey.

For lab work, use a focus layout:

1. next step, reason and observed state;
2. one stateful action such as **Run in lab**, **Approve and run**, **Check and continue**, or
   **Fix issue**;
3. the lab surface;
4. environment summary and diagnostics under Details.

Raw commands, copy buttons, result fields, credentials, machine settings, service controls and
audit output do not remain expanded beside the lab. The bottom navigation and assistant presence
must not cover the remote desktop, terminal, primary action or operating-system controls.

This standard follows established accessibility and service-design guidance: instructions should
be concise and adjacent to the activity, repeated input should be reused, long transactions should
be simplified before a task list is introduced, and secondary information should be disclosed only
when needed. See [W3C step-by-step instructions](https://www.w3.org/WAI/WCAG2/supplemental/patterns/o4p07-step-instructions/),
[W3C predictable interfaces](https://www.w3.org/WAI/fundamentals/accessibility-principles/),
[GOV.UK question pages](https://design-system.service.gov.uk/patterns/question-pages/),
[GOV.UK multiple tasks](https://design-system.service.gov.uk/patterns/complete-multiple-tasks/)
and [GOV.UK details](https://design-system.service.gov.uk/components/details/).

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
