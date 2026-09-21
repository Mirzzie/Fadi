# Fadi career-data model: researched proposal

21 September 2026. Proposal, not an implemented migration. Based on current Fadi source and primary enterprise architecture documentation. No personal career records changed during this research.

## Decision

Maintain one structured **My Career** record, with preserved source versions and explicit decisions about conflicting facts. Provide a complete master CV as a generated view of that record. Career directions and job applications hold selections and wording preferences; documents and portfolio releases record the versions they used.

This implements the user's requested experience: add work once, select or recommend relevant material for a direction/job, preserve preferred wording, and know which outputs need refreshing after an update.

## Current implementation, verified in source

| Area | What exists | Consequence |
| --- | --- | --- |
| Directions | `career_profiles` stores role, location, goals and an active direction. | A direction is not a full independent career identity. |
| Base CVs | `resumes` contains raw/parsed text per direction; the oldest direction alone can inherit an untagged legacy CV when it has no own CV. Upsert can overwrite the existing text. | There is no complete, immutable master CV history governing all directions. |
| Career history | `linkedin_profiles.rawText` is shared. `composeCareerEvidence` calls sufficiently substantial text authoritative, using a 200-character threshold. | Size and input label do not establish completeness or factual correctness. |
| Evidence | Shared rows with kind, organisation, text period, detail, metrics, tags, `factId`, canonical flag and review state. Alternative wording is still another row in the same table. | Useful shared pool; fact identity and presentation are not yet fully separate entities. |
| Selection | Evidence is ranked by active direction. `topEvidenceForPrompt` defaults to eight items. The job workspace can recommend lead/support/hold-back items. | The lead panel stores its result in component state; it is not a persisted selection contract enforced by every generator. |
| Documents | Generation combines raw CV/history and ranked evidence; documents already have optimistic version counters and revision snapshots. | Document editing history exists, but full fact-version dependencies and authoritative input isolation do not. |
| Learning | Finishing a project can save a reviewed summary through admission and link its evidence row to the project. | The new record becomes available; existing CVs are not automatically regenerated. |
| Portfolio | Independent items, some with an evidence link. The evidence-change subscriber revalidates the portfolio screen. | Revalidation is not data synchronization or publication of a new release. |
| Source/output limits | History is clipped for prompts; extraction caps a batch at 40; generation uses a ranked subset. | These are context limits, not an exhaustive career database. |

**Additional defect found during this review:** `lib/evidence/pool.ts` defines five kinds without `certification`; `normKind` falls back to `experience` for any other kind. The portfolio explicitly supports certifications. An extracted or displayed certification can therefore become employment-shaped data upstream. Unknown kinds should remain unclassified for review, never default to employment. This is source-confirmed; no new live-account import was performed to manufacture it.

Source pointers relative to the Fadi repository:

- `packages/database/src/schema/index.ts`: career profiles, resumes, evidence, documents/revisions, portfolio items.
- `packages/database/src/repositories/resumes.repository.ts`: scoped lookup and overwrite behavior.
- `apps/web/src/lib/career/evidence.ts`: authority heuristic and prompt clipping.
- `apps/web/src/lib/evidence/pool.ts`: kinds, normalization, extraction and ranking.
- `apps/web/src/lib/documents/generate.ts`: raw inputs plus evidence, active-direction lookup.
- `apps/web/src/components/workspace/lead-evidence-panel.tsx`: transient recommendation state.
- `apps/web/src/app/dashboard/learning/project-finish-actions.ts`: reviewed project-to-evidence path.
- `apps/web/src/lib/portfolio/subscribers.ts`: cache revalidation rather than content update.

## Enterprise patterns and their application

These sources describe established approaches; the Fadi design below is my adaptation, not a claim that any named company operates this exact career workflow.

1. **Master data management:** IBM describes consolidating shared entities, resolving duplicates/discrepancies and assigning stewardship. For Fadi, the person owns decisions about their history; imports cannot silently become a competing authority. [IBM MDM](https://www.ibm.com/think/topics/master-data-management).
2. **Provenance:** W3C PROV describes entities, activities, responsible agents, derivations and revisions. For Fadi, retain which source version and passage supplied a claim and which approved record version supplied a document block. A source establishes where a statement came from, not that it is true. [W3C PROV Primer](https://www.w3.org/TR/prov-primer/).
3. **Separate authoritative updates from output views:** Microsoft's CQRS guidance includes a single-database implementation. For Fadi, validate changes centrally and build CV/portfolio/interview views from the same approved data, within the existing PostgreSQL monolith. [Microsoft CQRS](https://learn.microsoft.com/en-us/azure/architecture/patterns/cqrs).
4. **Durable update notification:** AWS describes saving a change and its outbox event atomically, then processing notifications with duplicate-safe consumers. For Fadi, a crash after saving a project must not lose the work needed to refresh its dependent outputs. [AWS transactional outbox](https://docs.aws.amazon.com/prescriptive-guidance/latest/cloud-design-patterns/transactional-outbox.html).
5. **Historical versions:** Microsoft's temporal-table documentation illustrates preserving prior states for point-in-time inspection. Apply the history principle using PostgreSQL revision tables; no SQL Server migration is proposed. [Microsoft temporal tables](https://learn.microsoft.com/en-us/sql/relational-databases/tables/temporal/overview).

## Logical model

Use relational IDs and validated typed fields. This does not require a graph database, a general entity-attribute-value engine or a separate service for every object.

| Object | Essential contents | Ownership rule |
| --- | --- | --- |
| Source version | Owner, source family/version, source kind, original file/text, content hash, imported time, originating output ID/version when known | An upload produces a retained version. Do not overwrite prior source text. |
| Career record | Stable ID, owner, kind, current approved version ID, active/retracted status | One employment engagement/project/qualification has one stable identity. |
| Record version | Version number, typed facts, valid dates and date precision, recorded time, author/decision | Factual corrections produce a new version, preserving the previous one. |
| Source assertion / review | Source version and passage, proposed field/value, candidate record, review decision, supporting/contradicting relation | Conflicting assertions may coexist in intake; unresolved assertions are not generation authority. |
| Wording variant | Record/version references, direction/audience, selected supported claims, wording, human-edit status | Changes expression; cannot override employer, dates, qualification or numerical results. |
| Selection | Direction or application ID, record/claim IDs, Auto/Include/Exclude, order, preferred variant, locked wording | Job choices override direction defaults; unresolved/retracted data remain ineligible. |
| Output revision and dependencies | Existing document/site revision plus each used record version/claim, selection version, job snapshot, generation settings | Every factual block is traceable. A newer master version does not erase a submitted document. |
| Outbox task | Owner, changed record/version, event ID, delivery state, attempts, consumer result | Created in the same transaction as the factual update; safe to retry. |

Extend existing tables where semantics fit. The existing `documents` and `document_revisions` should remain. Separate fact identity from `evidence_items` rendering rows incrementally, preserving a mapping from every legacy ID.

### First-class career types

- Employment: employer, official position, engagement type, start/end dates, location, supported responsibilities/outcomes. Client and agency relationships are explicit; different companies are not interchangeable names.
- Project: context (personal, lab, academic, employment, freelance), contribution, outputs, skills and artefacts; optional link to an employment or education record. A project within a job remains a separate object.
- Education: institution, qualification, subject and dates.
- Certification: issuer, credential, awarded/expiry dates, credential identifier and optional verification link. Store unknown dates as unknown.
- Achievement: a supported outcome, linked to the work it arose from where known. Metrics use value, unit, scope/time and source when available.
- Skills: self-declared and demonstrated relationships remain distinguishable; listing a technology does not establish mastery.

Keep identity acceptance, factual confirmation, and proof scope separate. A person confirming an entry is not independent verification. A machine checking a lab configuration does not prove employment, independent authorship or mastery.

## Intake and external résumé round trips

1. Preserve the imported source before extraction; identical files can reuse a source version by owner-scoped hash.
2. Extract typed candidates with source passages. Unknown kinds/dates remain unknown. Employer/client/course-provider distinctions are explicit.
3. Retrieve candidate identities using stable Fadi IDs when available, then structured context, then semantic/lexical similarity. Treat scores as retrieval signals, not authority to change history.
4. Classify changes as unchanged, wording-only, new work, additional supported detail, factual conflict, or omitted material.
5. Automatically reuse exact confirmed content. Save demonstrably compatible wording as a variant; if equivalence cannot be established, ask. Show factual conflicts as a field comparison with the source passages.
6. Confirm the selected factual changes once, then update the master record transactionally. Absence from a shorter CV means omission for that audience, never deletion from career history.

For documents exported by Fadi, retain an export manifest where the format allows it. Reimport compares the exported baseline, the externally edited version and the current master record. Metadata may be stripped by another platform; then fall back to candidate review, without pretending an exact round trip was recovered.

A regenerated Fadi document imported later is derived content, not independent corroboration of its own claims. Repeating an assertion across ten CVs must not make it more trustworthy.

Overlapping dates are not automatically invalid: concurrent part-time work and employer/client assignments can be legitimate. Flag an unresolved contradiction in a proposed identity, rather than applying a blanket “one employer per year” rule.

## Selection and generation

The UI presents **My Career → Direction → Application**. The master CV is a complete preview/export of My Career, not a competing editable authority.

Within a direction or job, each record has Auto, Include or Exclude. Users can pin an item, reorder it, select individual supported bullets and preserve their wording. Application-specific choices override direction defaults. User exclusions and privacy rules apply before AI ranking. Never silently drop pinned content to meet a page limit; report the tradeoff.

Automatic ranking should consider actual job responsibilities, skills supported by the record, proof relevance, recency and coverage of distinct requirements. It should explain the choice. Do not tune an opaque universal score before validating it against representative jobs and the user's selections.

All document generators receive one **CareerContextSnapshot**: explicit user, direction and application IDs; approved record versions; exact selection; preferred wording; job snapshot; locale/style; and provenance references. Avoid resolving the mutable global active direction partway through an in-flight generation request.

The writer can change emphasis, order and prose within this snapshot. A different employer, date, title assertion, credential or result becomes a proposed factual change. Deterministic fields should render from structured values. Semantic review still has limitations; unsupported or uncertain additions must remain visible and must not receive a “verified” badge.

## Learning and external projects

A finished Fadi lab and an external project use the same “Add to My Career” flow. The lab provides recorded steps/checks and artefacts; an external project can provide a repository, write-up, screenshots or a manual description. Ask for the person's contribution and context without making artefacts compulsory for every legitimate record.

A check records what was observed, when, on which target and with which method. It does not certify the entire narrative. Include guided/AI-assisted context where relevant to a claim of independent work.

On approval: save one project/version, link its supported claims and sources, and make it available in every direction. Then show relevant suggested updates, with a preview of the new CV bullet, portfolio section or interview story. Completing a lab should not append that project to every existing CV regardless of relevance.

## Keeping outputs aligned

Alignment means shared facts and explicit freshness, while allowing different selections and wording.

| Surface | Behavior after an approved fact changes |
| --- | --- |
| My Career / master CV | Current view reads the latest approved record versions. |
| Direction preview | Selection remains; relevant available content and update indicators refresh. |
| Draft CV, cover letter or interview story | Dependencies mark affected blocks stale. Prepare a replacement revision; preserve manual wording and show a diff where needed. |
| Submitted/exported document | Preserve the exact historical snapshot. Indicate that a newer source version exists; create a new revision for reuse. |
| Live portfolio | Prepare a new coherent release and preview factual changes. Publish according to the person's configured policy; default to explicit review. |
| Static exports and downloaded files | Track the version emitted. Fadi cannot mutate copies outside its control or retract documents already sent to employers. |

Save the new record version and outbox entry in one PostgreSQL transaction. A small worker processes affected output dependencies, with retries and unique event/consumer keys. Check versions so late work cannot replace a newer projection. Store processing state; surface failures as “Update needs retry,” not “Everything synced.” Periodic reconciliation detects missed or failed updates. Public release should atomically promote a prepared version to avoid mixed old/new facts.

Do not regenerate every PDF after every keystroke. Perform shared authoritative reads synchronously; asynchronously prepare expensive derived updates only where dependencies changed. Explicitly surface expected temporary lag.

## UI: three concepts, limited decisions

- **My Career:** everything known, grouped by meaningful type, with “Add or import,” source/details on demand, and a review inbox for unresolved changes.
- **Tailor:** choose direction/job, inspect recommendations, Include/Exclude/Auto, lock wording, preview the resulting document set.
- **Updates:** one affected-output summary, for example “New project saved; two drafts can use it; portfolio update available.” Review relevant differences together.

In an editor, factual edits offer “Update My Career”; presentation edits offer “Keep for this document/direction.” There is no factual company override hidden inside a tone setting.

## Implementation sequence and acceptance criteria

1. **Authoritative foundation:** explicit types including certifications; immutable source versions; versioned career records; existing-record repair preview; remove raw-text authority bypass only after migration supplies a complete context. No fallback that quietly reinstates conflicted raw text.
2. **Selections and one context builder:** persist direction/job overrides and output dependencies. Migrate CV/letter/portfolio/interview generation to the same contract. Compare old/new output inputs before enabling each route.
3. **Durable propagation:** transactional outbox, stale indicators, replacement drafts, release management, retries/reconciliation.
4. **Complete round trips:** source manifests, three-way review where possible, external project capture and lab completion through the same intake.

Required behavioral checks:

- Ten role-specific CVs of one employment remain one employment with variants; omission does not delete anything.
- Changed company/date/result becomes a factual decision, never a tone change.
- Certifications cannot become experience; a degree and its project stay related but separate.
- A rejected old claim cannot be reintroduced through raw-text generation or a reimported generated PDF.
- Each direction/job preserves its selections and wording; switching direction mid-request cannot change the snapshot.
- A lab or external project is added once and offered where relevant, without silently editing sent documents.
- Concurrent edits are detected; a worker crash/retry cannot lose an update or duplicate output records.
- Every output can identify its source versions and report whether a change affects its factual claims.

Recommendation: keep the modular monolith, PostgreSQL, existing document revision mechanism and one small background worker. Adopt the enterprise principles of controlled authority, provenance and reliable propagation. A microservice fleet, Kafka, a graph database and full event sourcing are not prerequisites for this workload.
