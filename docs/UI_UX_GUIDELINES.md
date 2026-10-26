# Fadi UI and UX guidelines

**Status:** Current product standard for every new or changed surface
**Updated:** 26 October 2026 (capability seam and owner-selected visual direction)

The owner-selected Conversion/Mara Voss facelift is implemented on
`release/ui-review-20261026`, based on current main plus the reviewed facelift and nested-surface fixes. The capability rendering
contract must reuse its shared components and design tokens, not introduce a parallel aesthetic.
This candidate is not promoted to main and does not claim every surface is accepted.

Fadi should feel like one calm, capable career partner guiding one career journey. A screen is
successful when a person can answer three questions without learning Fadi's architecture:

1. What is happening?
2. Does Fadi need me?
3. What should I do next?

Features are not the unit of interface design. **The person's work is the unit.** Job discovery,
documents, interview practice, labs, evidence and publishing are stages and capabilities attached
to that work.

## Reference model and limits

Fadi borrows patterns, not branding or product metaphors. These references are deliberately not
equal. When they disagree, use this order:

1. **Pipecat for visual language and live interaction** — space, typography, focus, realtime state,
   voice and the feeling that the product is alive.
2. **Paperclip for work structure and operational clarity** — goals, work threads, attention,
   decisions, approvals and traceability.
3. **Current Fadi for domain identity and proven behaviour** — the four destinations, career truth,
   safety contracts. Existing visual patterns are not presumptively retained.
4. **UniMad for career-journey comparison only** — shared profile context and end-to-end flow. It is
   not a visual reference until its authenticated product is independently evaluated.

Do not average the four styles. A Fadi screen should look and feel closest to Pipecat, organise work
like Paperclip, speak in Fadi's career language, and use UniMad only to check that the job-seeker
journey is complete.

| Reference    | Use in Fadi                                                                                                                                                        | Do not copy                                                                                                                                     |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| Paperclip    | Goal-aligned work, one attention queue, work threads containing activity and decisions, persistent status, inline approvals, traceable execution                   | Org charts, agent employees, budgets, ticket administration, dense operator dashboards                                                          |
| Pipecat      | One live multimodal session, explicit listening/thinking/speaking/acting states, natural turn detection, interruption, typed screen commands, cancellable progress | Provider selectors, pipeline internals, developer controls, an always-on microphone                                                             |
| UniMad       | One profile grounding the job-search journey, low-clutter presentation, role positioning before documents, discovery connected to applications and interviews      | A new UniBoard destination, visible specialist-agent topology, ATS scores presented as truth, marketing and coaching funnels inside the product |
| Current Fadi | Four human destinations, career direction, canonical career record and trustworthy evidence                                                                        | Card walls, infrastructure-first controls, duplicate conductors, raw logs as the experience                                                     |

The references support these choices:

- Paperclip presents work as goal-aligned tasks with conversations, activity and decisions attached
  to the task, and centralises human decisions instead of scattering them across pages.
- Pipecat separates the voice conversation from a UI worker that receives screen context and emits
  typed UI commands. Its turn detection and interruption model treat a pause as distinct from the end
  of a person's turn.

Sources: [Paperclip](https://paperclip.ing/), [Paperclip tasks](https://docs.paperclip.ing/guides/day-to-day/issues/),
[Paperclip decisions](https://docs.paperclip.ing/guides/day-to-day/decisions/),
[Pipecat UI worker](https://docs.pipecat.ai/pipecat/learn/ui-worker),
[Pipecat turn detection](https://docs.pipecat.ai/pipecat/learn/speech-input),
[Pipecat interruptions](https://docs.pipecat.ai/pipecat/fundamentals/interruptions), and
[UniMad](https://www.unimad.ai/). The authenticated UniBoard jobs screen was not available for
independent inspection; decisions attributed to it must remain limited to public product claims and
the public shell until a signed-in evaluation is performed.

## The experience model

Every journey uses one chain:

```text
Goal → Plan → Next step → Execution → Receipt → Output → Evidence → Projection → Outcome
```

- **Goal** explains why the work matters.
- **Plan** is the resumable sequence Fadi owns.
- **Next step** is the only primary action presented now.
- **Execution** is observable work by the person, Fadi or an approved tool.
- **Receipt** records what actually happened.
- **Output** is the resulting document, lab artefact, message or assessment.
- **Evidence** is an approved claim about the person's career record.
- **Projection** adapts evidence for a résumé, portfolio, interview story or public post.
- **Outcome** records what happened in the world and changes what Fadi recommends next.

A domain may project this chain differently, but may not invent a parallel plan, completion state,
approval store or activity log.

## Four destinations

Use the navigation source in `apps/web/src/components/os/navigation.ts`:

| Destination   | User question                              | Areas                                    |
| ------------- | ------------------------------------------ | ---------------------------------------- |
| Today         | What matters now?                          | Today, full picture, career report       |
| Opportunities | Where can I go and what is happening?      | Roles, applications, people              |
| Practice      | What should I learn, build, or rehearse?   | Learning, interview practice             |
| My career     | What is true about me and what do I share? | Record, documents, portfolio, directions |

Profile and Settings belong to the account menu. Machines, permissions, provider health, audit
events and raw logs are contextual or advanced controls.

The owner-selected navigation is the same compact, hideable four-destination bottom dock on desktop
and mobile. Do not add a competing left rail or destination tabs to the top utility bar. Lab focus
mode may collapse navigation so it never covers the remote desktop, terminal or primary action.
Capabilities do not add top-level navigation independently; the shell projects the user's composition.
Reserve space for the dock while visible and keep its reveal control keyboard accessible.

## Product shell

The shell has three responsibilities:

1. show where the person is;
2. show Fadi's live state and the work it belongs to;
3. surface decisions that need the person.

The shell must not become a fifth dashboard. It shows:

- the current destination;
- the active direction or goal, once;
- Fadi's current state;
- one count for decisions needing attention;
- account and settings access.

Apply and Prepare are lifecycle phases of the active goal. They may reorder recommendations and
change the next action. They must not hide routes, records or capabilities.

## The work surface

A substantial piece of work uses one consistent surface:

```text
┌ Context: goal, object, status ────────────────────────────┐
│ Next: one explanation + one primary action                │
├──────────────────────────────────────┬─────────────────────┤
│ Work thread                          │ Context inspector   │
│ user intent, plan progress,          │ facts, properties, │
│ Fadi activity, receipts, outputs,    │ history, advanced  │
│ failures and decisions in sequence   │ controls           │
└──────────────────────────────────────┴─────────────────────┘
```

The inspector is optional and closed by default. On small screens it becomes a sheet. The work
thread is not a generic chat transcript: it is the durable narrative of this work. Voice, text,
buttons, tools and background work continue the same thread.

Approvals render inline at the consequential action. Today may show the same approval in the
attention queue, but it is the same record and resolution, not a second workflow.

## Page hierarchy

Every primary page presents, in order:

1. current goal or object;
2. state in plain language;
3. one primary next action;
4. decisions blocking progress;
5. recent verified result;
6. optional details and advanced controls.

Do not present every engine, source, recommendation type or machine action as a peer. Do not use a
grid of equal cards when the actions have a natural order.

## Interaction budget and replacement rule

Adding a capability does not justify adding a permanent control. The default task surface has:

- one clear state;
- one recommended action;
- at most one secondary choice when it changes the outcome;
- one compact environment or context line;
- details, commands, logs, provenance and administration disclosed on request.

If Fadi owns the data, can observe the result or has an approved execution channel, it must not ask
the person to re-enter, copy, paste, relay or manually confirm that information. The normal sequence
is:

```text
observe → propose consequential change → approve if required → execute → verify → record receipt
```

Manual work is appropriate when it is the skill being learned, an external environment cannot be
observed, or an authority boundary such as `sudo` requires the person. In learning mode, Fadi may
teach the command before running it; the learner chooses **Guide me** or **Do it with Fadi**, not a
series of copy buttons.

Every visible feature change must include a **surface delta**:

- controls added;
- controls removed, merged or moved under Details;
- primary actions before and after;
- duplicate state owners removed.

Adding a new card above old cards is incomplete work. If no surface can be retired, the change
needs evidence that it represents a distinct user decision.

## One authority for each concept

One object has one authoritative state and one conductor. Views may project it, but must not own
separate polling, readiness, approval or completion logic.

| Concept         | Authority                             | Projections                                   |
| --------------- | ------------------------------------- | --------------------------------------------- |
| Work progress   | Work kernel and executions            | Today, relevant workspace, Fadi presence      |
| Human decisions | Shared attention/approval record      | Inline action, Today queue, shell count       |
| Career truth    | Canonical career record and history   | Résumé, portfolio, interview, public campaign |
| Lab readiness   | Project conductor and observed checks | Next action, compact Environment line         |
| Fadi live state | Shared agent session                  | Shell, orb, active work surface               |

A projection never silently repairs or overwrites its source.

## Fadi presence, voice and screen context

Fadi is present across the system, not confined to a chat window. The UI exposes these semantic
states when relevant:

- ready;
- listening;
- understanding;
- speaking;
- acting;
- waiting for approval;
- blocked;
- offline.

Rules:

- Listening is visible and user-initiated; there is no always-on microphone.
- A short pause does not automatically end a turn. The person can finish explicitly, and semantic
  turn detection may finish when confidence is sufficient.
- The person can interrupt Fadi while it speaks and cancel long work while it acts.
- The live transcript is visible and correctable before a consequential interpretation.
- Voice, text and controls use the same work session, context envelope, tools, approvals and
  receipts.
- Fadi names the action, target, expected effect and reversal before consequential execution.
- The orb signals presence; it is never the only route to a waiting decision.

The runtime boundary is defined by ADR 0013. The conversation worker does not receive an arbitrary
DOM dump or mutate the page directly. A screen-context worker receives a bounded accessibility
snapshot and active work context, then returns typed UI commands. Long work belongs to the task
executor and reports cancellable progress.

## Today

Today is an attention and continuation surface. It shows:

- the active goal;
- one next action;
- what Fadi is doing now;
- decisions waiting for the person;
- recent consequential receipts;
- no more than three grounded suggestions.

It is not an analytics dashboard. Empty sections explain the next useful setup action instead of
showing zero metrics.

## Opportunities and application workspaces

An opportunity workspace changes with the lifecycle stage while keeping one narrative:

1. decide whether the role merits time;
2. prepare and review the required application package;
3. submit or record the external submission;
4. prepare for the actual interview stage;
5. follow up;
6. record the outcome and learn from it.

Show one next action for the current stage. Résumé, cover letter, email and value proposition are
outputs within the package, not four equally prominent workflows. Fit, score and red-pen analysis
are checks attached to the relevant output, not permanent accordion panels.

Interview practice launched here inherits the role, employer, posting, direction, region,
seniority, application documents and relevant evidence. The user is not asked to select them
again.

### Job discovery board

Do not add a separate UniBoard-style destination. The board is the discovery stage of
**Opportunities** and feeds the existing role and application workspace.

Desktop uses a compact list plus selected-role detail. Mobile opens one role at a time. The default
view shows roles matched to the active direction and stated market. One search field accepts role,
place and work mode in natural language. Saved filters are available under refinement, and source
health remains under diagnostics.

The default result row contains only what changes a decision:

- title, employer and location;
- freshness and original source;
- a grounded fit label with the strongest evidence and any hard blocker;
- current stage such as new, saved, preparing, applied or interviewing;
- one action appropriate to that stage.

The full description, matched terms, source diagnostics and scoring explanation belong in the
selected-role detail. Do not present a 0–100 fit or ATS number as objective truth. Use labels such as
**strong evidence**, **possible fit**, **missing required experience** or **posting may be stale**, with
the supporting facts visible.

Search progress, cached-result age, provider failures and market coverage remain honest but compact.
The main journey says what Fadi found and what to do; **Search details** explains which sources ran.
Paste-a-link is a secondary entry inside the same search control.

## Practice, learning and labs

Practice exposes three concepts:

- **Continue** — the current activity and next step;
- **Recommended next** — one recommendation with a reason;
- **Explore** — optional courses, projects and interview practice.

A project workspace uses focus layout:

1. one **Next** state and action;
2. the lab surface;
3. a compact **Environment** line;
4. the remaining plan as orientation;
5. diagnostics and infrastructure controls under Details.

The project conductor verifies prerequisites and determines the next step. A check that fails must
say what Fadi observed, the likely known cause, and the recovery action. Unknown failures say what
was checked and remain unknown; they are not filled with model guesses.

Raw commands, copy buttons, result fields, credentials, machine settings, service controls and
audit output remain collapsed unless they are the learning material or a fallback is required.

A commitment has one finish line. A generated practical project completes through its run; an
external course or activity uses a compact completion review. Both call the same outcome service.

## Completion and personal brand

Completion first asks: **Is this an accurate record of what you completed?**

After approval, show one completion package with optional proposals:

- add or update the career record;
- place it in the portfolio;
- suggest résumé wording;
- create an interview story;
- draft a multi-channel campaign.

Each proposal is Accept or Skip. The same approved facts and media feed every destination. Media is
optional. Say **Add proof** when useful; never publish a “no evidence” placeholder.

Direct publishing requires a channel-specific connection, preview and explicit approval. Copy,
download and open-share remain the reliable fallback.

## Interview practice

The default setup asks only:

- interview stage;
- 10 or 20 minutes;
- **Start talking**.

Put overrides under **Change context**. During the interview, the dominant surface is the human
exchange: interviewer presence, live listening state, concise transcript and one stop control.
Configuration and rubrics remain outside the live stage.

Fadi waits through thoughtful pauses, supports interruption and keeps questions grounded in the
specific role and the person's actual evidence. Use competencies and behavioural anchors rather
than an ungrounded decimal score. If no career story matches, say so and create a preparation step.

Call transcript-only measures **answer length and filler words**. Reserve delivery coaching for
measured audio duration, rate, pauses and interruptions. Do not grade accent conformity.

## My career

My career starts with the canonical record. Source versions, provenance, variants, direction
selection and reconciliation are available when needed, not shown as default controls on every
record.

A person adds outside work through one intake flow:

1. import a source or add a fact;
2. review the proposed canonical records and conflicts;
3. approve the truth once;
4. attach optional proof;
5. let directions and outputs project from it.

Auto/Include/Exclude and wording variants are advanced decisions within a direction or document.
They are not the primary Evidence page experience.

## Visual system

### Owner-requested Conversion reference — 21 October 2026

The owner additionally selected [Conversion](https://conversion.framer.media/) to give the
public-facing experience more warmth and character. For the landing page, adapt its focused
composition, restrained coral accent, editorial serif emphasis, soft horizon light and compact
FAQ disclosure. This is an explicit brand-moment exception to the routine-work decoration rules
below, not permission to turn dashboards, editors or labs into marketing pages.

Keep Pipecat's live-surface discipline and Paperclip's work organisation. Preserve the owner's
four-destination hideable bottom dock; do not reintroduce destination tabs in the top bar.
Conversion's marketing navigation is not an authenticated app-shell pattern.

The reference's coral is `#ff4533`. Use a contrasting dark foreground for small text on this
colour, and a darker coral foreground in light mode. Its observed typography is Satoshi plus
Instrument Serif. The initial adaptation retained Inter; the composition pass uses self-hosted
Mona Sans (also observed on Mara Voss) plus Instrument Serif editorial accents and JetBrains Mono
for identifiers. This deliberately does not claim Satoshi and Mona Sans are identical faces.
The reference remained dark under an emulated light preference: Fadi must supply a separately
tested light counterpart and respect its existing explicit theme selection.

Do not copy template testimonials, client counts, client logos, imagery or outcome promises.
Illustrative product previews must say they are examples, not the person's account state.

The additional [Mara Voss reference](https://diligent-tetragon-837366.framer.app/) contributes
warm layered surfaces, compact translucent navigation and brief hover transitions. REA observed
14px navigation blur and roughly 150ms transitions. Its Bone/Tangerine/Ink backdrop selector is
not evidence of automatic light/dark support. Do not transfer its huge portfolio typography,
portrait composition or continuous decorative motion to task screens.

### Primary direction: Pipecat

The interface uses Pipecat's visual discipline as its main reference:

- high-contrast neutral canvas with substantial breathing room;
- large, confident type for the page's single purpose;
- a restrained grid or technical texture only where it gives orientation;
- one contained live surface as the focal point;
- crisp borders and direct controls instead of layered decoration;
- realtime state made visible through precise text, motion and one accent colour;
- product capability demonstrated in the working surface rather than explained through card copy.

This does not mean every page becomes a marketing hero. Entry, empty and completion moments may use
large type and open space. Active workspaces become denser while preserving one focal region.

### Structural direction: Paperclip

Use Paperclip's disciplined information hierarchy beneath that visual language:

- slim persistent navigation;
- compact rows and separators for repeated information;
- work status and decisions placed in the work narrative;
- optional inspector rather than permanent secondary panels;
- consistent semantic status vocabulary;
- actions and traces beside the object they affect.

Do not copy Paperclip's agent-company dashboard density, org chart, budgets or administrative chrome.

### Fadi identity

Fadi retains:

- Ember, Iris and Cobalt palettes, each with Light/Dark/System behaviour;
- Mona Sans with Instrument Serif editorial accents and JetBrains Mono for identifiers;
- the four career destinations;
- approachable career language;
- the Fadi presence mark, integrated into the shell rather than floating over work;
- dark focus mode where it improves labs, terminals and live interviews;
- Light, Dark and Follow system modes with the same hierarchy and contrast.

The owner's [Conversion](https://conversion.framer.media/) and
[Mara Voss](https://diligent-tetragon-837366.framer.app/) references add warm lighting, restrained
glass chrome, a palette-aware pointer trail and finite entrance/hover/panel motion. Use the shared
facelift implementations and accessibility fallbacks; do not copy template branding, testimonials
or outcome claims. Keep editing, assessments, approvals and lab content readable and opaque.
Capabilities cannot ship fonts, colours, CSS, animations or alternate navigation in their descriptor.

`apps/web/src/app/appearance.css` owns palette and surface tokens, including public portfolio
and export aliases. Browser-local preferences use the existing theme key plus one palette key;
they are not account-synchronised or published as the portfolio owner's branding. Settings and
the public appearance disclosure use the same preference implementation.

Subtle glass belongs to navigation and overlays, with opaque fallbacks for unsupported blur,
reduced transparency, high contrast and forced colours. Editors, assessments, approvals and lab
work remain opaque. Avoid glowing card borders, repeating background grids and oversized radii.

### Component grammar

Use `PageIntro` for account and work-index headings: one visible h1, a bounded description and
optional contextual actions. Keep custom editorial composition on Today, Practice and the public
landing page. The shell owns the main landmark and horizontal gutter; its child pages must not
add another main or double the gutter. Routine work indexes use a 74rem maximum; document and
lab workspaces retain their wider task-specific containers.

Shared fields and standard buttons are 40px high, with 44px minimum targets on coarse pointers.
Small desktop toolbar actions may use the compact button size. Editor toolbars wrap instead of
overflowing; mobile editors use normal document flow rather than forcing nested viewport-height
scroll regions. Preserve paper-template colours in exported documents and the independent root
error fallback: these have different rendering constraints from application chrome.

Contextual Pipeline/Documents views belong to the URL (`view=documents`), with browser Back and
Forward support. Keep inactive panels mounted to preserve local drafts, while excluding their
hidden controls from orb guidance. These are work-local views, not top-level destination tabs.

- Prefer one bounded work surface over several rounded cards.
- Use separators and spacing before adding containers.
- Reserve pills for status, filters and compact metadata; do not put ordinary labels in pills.
- Use one primary button colour per screen. Secondary actions are quieter.
- Keep repeated result rows compact; open detail alongside or on demand.
- Use monospace only for commands, identifiers, addresses and machine values.
- Use semantic colours for success, caution, danger and blocked state.
- Keep colour, type, spacing, radius, shadow and motion in one token source.

Hierarchy comes from structure, typography and whitespace. Shared lighting/material/motion adds
continuity without obscuring state or actions. Do not add repeating grids, uncontrolled ambient
effects or a second assistant. Respect reduced motion, touch, contrast and focused-work behaviour.

### Content follows the product contract

Describe the current direction, applications, practice, career record and outcomes concretely.
The Adaptive Career Loop is the wider direction, not permission to advertise unfinished research,
strategy, continuous monitoring or automated eligibility decisions as available. Separate current
capability from planned capability. Keep person-stated choices distinct from observed evidence and
verified checks; do not flatten them into one score. Avoid guaranteed jobs, universal eligibility,
"nothing invented", "always working" or "nothing leaves" claims without enforceable evidence.

Motion has named tokens and a purpose: orient, acknowledge or show continuity. Respect reduced
motion. Do not use ambient animation around urgent decisions, text entry or remote desktops.

### Approved capability templates

Capability surfaces use the shared shell/template catalog. A template owns hierarchy, keyboard
behaviour, focus, responsive density, theme and motion; capability data cannot override them.
One current work context has one primary action and one completion review. A configurable workspace
may contain several bounded regions without becoming a wall of equal actions or independent stores.
Keep stable entity/work deep links and the existing work, permission and evidence authorities.

Reflection is optional private work, not a compulsory mood card above every screen. Declining it
does not mark a task incomplete, erase evidence, alter strategy or imply a conclusion. Its sensitive
content stays out of ordinary screen-context capture and career exports without a specific grant.

### Reference motion rollout — owner request, 26 October 2026

The owner requested the Conversion/Mara Voss effects throughout Fadi, not solely on the landing
page. `motion.css` owns the shared timing/easing for surface entrances, controls, menus and dialogs.
Use one surface-entry mechanism rather than stacking a route transition and a card transition on
the same content. `SurfaceEffects` provides viewport entrances and pointer lighting across shared
intros/cards and explicitly marked editorial regions. Content remains readable when JavaScript
or an observer is unavailable; entering a viewport never changes work status.

The 16px palette-aware trailing dot is decorative and pointer-transparent; the native pointer stays
visible. It is not another assistant or the orb guide. Stop it while typing, scrolling, in focused
lab/simulation workspaces, on touch, or when reduced motion is requested. Reduced motion cancels
active decorative animations. High contrast/forced colours and printing omit the trail and lighting.
Do not mutate streamed React content attributes for animation: native animation effects and a
private stylesheet avoid introducing hydration differences.

Portfolio and application dialogs reuse the shared dialog primitive for naming, focus containment,
Escape and return focus. Long portfolio forms retain a visible header and action footer. Labels
must identify their actual fields. Inactive mounted work tabs must close their portals while
preserving the underlying local draft; the URL remains the view authority.

### Contextual orb guidance

Guidance is explicitly requested through **Show me**. Reposition the existing orb beside an
application-registered target; never add a second assistant or replace the person's cursor.
Keep the target clickable, its action unchanged and Stop/Escape available. Highlighting or
dismissing guidance never completes work. Target removal, disabling, hiding or leaving the visible
viewport cancels the presentation. Reduced motion removes travel. The first slice is local UI
guidance, not a new model-command capability or an automatic cross-route tour.

## Content and feedback

- Buttons name the action: **Check and continue**, **Approve and run**, **Save as evidence**.
- Status describes observed reality, not intent.
- Errors say what happened, what Fadi checked and what can be done next.
- Keep waits and errors inline while they remain relevant.
- Do not toast a state already visible on the page.
- Explain why a recommendation matters to the active goal.
- Never expose provider, model, hypervisor or pipeline choice until the task requires it.
- Keep destructive controls available, clearly scoped and separated from routine actions.

## Accessibility and responsive behaviour

- Every action works by keyboard and has a visible focus state.
- Icon-only controls have accessible names; primary navigation has visible text.
- Do not use colour as the only status signal.
- Announce asynchronous status and validation with appropriate live regions.
- Preserve logical heading and landmark order.
- The screen-context worker consumes the same accessibility semantics the person relies on.
- At narrow widths preserve goal, state, primary action and Fadi status before secondary detail.
- Remote desktops and terminals must retain usable keyboard, viewport and operating-system controls.

## Review gates

A changed journey is not complete until a reviewer can answer yes to all applicable checks:

1. Is there exactly one primary action?
2. Can the person tell what Fadi observed versus inferred?
3. Is the authoritative state shared rather than copied locally?
4. Did the change remove or demote an older control?
5. Can the person resume after reload or interruption?
6. Can long work be cancelled and consequential work be approved at the point of action?
7. Are failure and recovery visible without reading a raw log?
8. Does voice continue the same work as the screen?
9. Does the narrow layout preserve the task and action?
10. Was the journey tested with its real data shape and signed-in state?

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
- duplicate forms asking for context Fadi already owns;
- generic chat as the primary way to discover or move work;
- equal card grids for actions that have an order;
- a second poller, conductor or state machine for an existing concept;
- autonomous UI clicks generated from unbounded model text.
