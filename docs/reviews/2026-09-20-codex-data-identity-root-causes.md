# Fadi data identity investigation — 20 September 2026

**Judgement: the product has the right intention but does not yet implement a dependable career fact system. It mixes descriptions, identities and claims of truth. Your use of differently worded résumés is a normal requirement; the current design fails that requirement in both directions: it duplicates some real work and collapses unrelated work. A larger model or a different similarity threshold will not permanently repair this.**

This assessment uses current production source, a transactionally consistent read-only snapshot of the local account selected by portfolio handle, and executable reproductions using the actual matcher, admission and reconciliation functions. No fresh LLM extraction or external AI call was needed. The only live changes were your explicitly requested removal of Hexastack. Existing employment groups were not automatically merged or split.

**What actually happened with the employers**

The saved SOC Analyst résumé contains **Spark Technomedia, IT Support Consultant, Jan–Aug 2026**. The saved DevOps résumé and shared history field contain **Hexastack Solutions, IT Support Specialist, Jan 2026–Present**. The portfolio independently stored both. Spark had an evidence link; Hexastack had none. Neither the screenshots nor the stored records establish how the false employer was originally introduced. The present values show it existed upstream of the portfolio. Calling this a proven generation hallucination would overstate the evidence.

You clarified that the companies are different, you worked at Spark, and Hexastack must be removed. I removed exactly the Hexastack employment block from the saved DevOps résumé's raw/parsed text, the shared history, and its single portfolio item in one transaction. Post-write checks found zero occurrences in those active sources/portfolio fields. Spark and the other jobs were left intact. A restricted recovery copy is under `.private/`, excluded by this audit directory's `.gitignore`; the original temporary recovery copy also exists. No source text is included in this report.

**This corrects the reported false employer, not the whole data architecture.** Sixteen saved documents, six career reports, four immutable document revisions and one interview story contained Hexastack at audit time. These existing outputs were not rewritten or deleted. No GitHub Pages export was republished, and no previously downloaded résumé can be changed from inside Fadi. The repair inventory is in `hexastack-removal.json`.

Matching years alone should never trigger an automatic employer merge. Concurrent work, contracting, client relationships and imprecise dates are possible. In this case the decisive evidence is your explicit correction, not a timeline heuristic.

**The more serious live finding**

Before the employer cleanup, the account contained 20 evidence rows, 11 canonical rows, and 40 portfolio items. Only 12 portfolio items linked to evidence; 28 were independent records. Four linked portfolio entries pointed to noncanonical evidence rows. After removing Hexastack, there are 39 portfolio items and 27 without evidence links; the evidence counts are unchanged.

There are nine noncanonical evidence wordings. Five belong to a different entity kind from their group's canonical record. Three groups mix fundamentally different objects:

| Current canonical record | Rows stored as its alternative wording |
| --- | --- |
| Private Network Storage & Identity Management Deployment | A Junior DevOps Engineer Trainee employment row, plus a project wording |
| Automated DevSecOps Pipeline Deployment & Runtime Protection | MSc Cybersecurity; AWS Certified Cloud Practitioner; AWS Cloud Intern; other projects and another pipeline wording |
| AWS Cloud Intern | Bachelor of Computer Application |

A dissertation can belong to a degree, and a project can be completed during an internship. That is a relationship, not identity. Calling the degree a wording of the project erases a qualification from canonical-only readers.

**Every group currently has exactly one canonical row.** The structural invariant passes while the semantic model is corrupted. This directly revises our earlier audit emphasis: atomic transitions and canonical counts are necessary, but they cannot establish that a group contains the right things. The data does not retain enough decision provenance to attribute each historical grouping to an automatic admission versus a user merge.

**How data moves today**

1. **Receive.** Profile uploads extract PDF/DOCX/DOC/TXT into plain text, returned to the form for review. Saving updates the shared history and the active direction's résumé. The résumé repository overwrites the latest row in place, so it is not an immutable source-version archive. Saving Profile does not itself reconcile existing evidence or portfolio entries. [Profile actions](/home/mirzzie/Projects/careeros-transfer-20260601-205559/careeros/apps/web/src/app/dashboard/profile/actions.ts:30), [résumé storage](/home/mirzzie/Projects/careeros-transfer-20260601-205559/careeros/packages/database/src/repositories/resumes.repository.ts:106).
2. **Choose input.** `getCareerReportContext` retrieves the currently active direction's résumé plus shared history. `composeCareerEvidence` treats sufficiently long shared text as authoritative and the résumé as supporting detail. The label is chosen mainly by length and whether the content is just a URL, not by verification, recency or conflict resolution. It sends up to 8,000 history characters and 4,000 supporting résumé characters. “LinkedIn” here describes a field, not proof that LinkedIn supplied or verified it. [Evidence composition](/home/mirzzie/Projects/careeros-transfer-20260601-205559/careeros/apps/web/src/lib/career/evidence.ts:25).
3. **Extract.** On Build/Add more from history, the LLM returns up to 40 entries with titles, organisation, free-text period, detail and tags. It receives instructions not to invent, but emits no source-span reference, source version, stable employment ID or per-field attribution. An unknown kind becomes `experience`. All extracted rows receive origin `ai`, even when the source wording was written by you. [Extraction](/home/mirzzie/Projects/careeros-transfer-20260601-205559/careeros/apps/web/src/lib/evidence/pool.ts:239).
4. **Resolve and store.** Candidates go through the admission gate, which loads the canonical pool and applies similarity. It either creates a row or attaches/promotes wording in an existing fact group. The gate has no durable identity decision record, import fingerprint or per-source mapping. [Admission](/home/mirzzie/Projects/careeros-transfer-20260601-205559/careeros/apps/web/src/lib/identity/admit.ts:154).
5. **Rank and generate.** Evidence readers return only canonical rows. Direction ranking weights market tags, original tags and keyword overlaps; the prompt takes the first eight. Document generation additionally reads raw history and the base résumé. Therefore evidence is not the sole input or sole source of truth. Saved noncanonical wording is not automatically selected by audience in this prompt path. [Pool ranking](/home/mirzzie/Projects/careeros-transfer-20260601-205559/careeros/apps/web/src/lib/evidence/pool.ts:183), [generation](/home/mirzzie/Projects/careeros-transfer-20260601-205559/careeros/apps/web/src/lib/documents/generate.ts:127).
6. **Project to portfolio.** Seed and Sync copy evidence into portfolio rows. The link targets an evidence wording row, not an independent fact entity. Existing editorial copies are retained rather than updated. Manual/import paths can have no evidence link. The evidence subscriber merely refreshes the CMS route; it does not reconcile the public content. Evidence merge/split/promotion actions do not publish the ordinary evidence-change event. [Projection](/home/mirzzie/Projects/careeros-transfer-20260601-205559/careeros/packages/portfolio/src/view.ts:177), [sync](/home/mirzzie/Projects/careeros-transfer-20260601-205559/careeros/apps/web/src/app/dashboard/portfolio/actions.ts:270), [subscriber](/home/mirzzie/Projects/careeros-transfer-20260601-205559/careeros/apps/web/src/lib/portfolio/subscribers.ts:24).
7. **Publish and check.** The public page reads published, confirmed portfolio rows. Duplicate detection is heuristic; timeline/contradiction analysis is an optional AI pass. There is no required structural source-conflict check before publication. The historical publish-gate migration also backfilled confirmations for existing published rows, so `confirmed_at` alone is not a proof of specific human review. Saved documents, reports, stories and static exports are further independent copies.

See `current-data-flow.mmd` for the full diagram. The material point is that copying happens more often than linking, and source corrections do not reliably invalidate copies.

**Why the matching behaves unintelligently**

| Finding | Actual mechanism and consequence |
| --- | --- |
| I01 — related objects become the same object | `comparableKinds` accepts any pair among experience/project/education/certification/achievement/custom. This permits the mixed groups observed in live data. A cross-section filing error and two genuinely different entities need distinct decisions. |
| I02 — vocabulary is treated as identity | Four shared “rare” tokens yield 0.55; the maybe threshold is 0.5. Terms like “handled, issues, resolved, ensure” count. Technical similarity says what work concerns, not which real event it is. |
| I03 — uncertainty already changes data | `admitAgainst` selects same OR maybe, then absorbs machine input or promotes human input over machine wording. “Maybe” is a flag on a committed link, not a pending decision. In portfolio admission it can instead withhold the candidate. |
| I04 — structured anchors are dropped | `Candidate`, `toIdentity`, row adaptation and normalisation omit attribution. The matcher only uses organisation as an anchor for employment/education/client attribution. Correct database attribution consequently never reaches several important comparisons. URLs can enter Candidate but are not stored as evidence provenance. |
| I05 — small pools and unrelated additions change outcomes | IDF is `log(N/df)` within the current pool. For two identical records, every word appears in both, so lexical mass is zero. A repeated item is created again. Add six unrelated entries and the same pair becomes a maybe/update. There is no exact-content or source-entry idempotency guard first. |
| I06 — dates are sets of year strings | January–February and November–December 2026 are described as overlapping. Conversely a 2020–2024 interval and a 2022-only record share no endpoint year. There is no month precision, interval or ongoing-status model. |
| I07 — reconciliation contradicts admission | The cross-store reconciliation has a same-title/same-kind shortcut. A job with the same title at a different employer and date can be declared the same without checking either. It can also pair several records to one portfolio item. |
| I08 — user correction is not learned | “They're different” only adds the merge ID to React component state. Refresh loses it; it does not protect the next import or another surface. It is not even a persisted unordered pair decision. |
| I09 — one global leader loses audience meaning | Wording authorship is inferred from origin; extraction means machine, most other origins mean human. Different human detail text is called conflict even if it is a harmless DevOps/support rewrite. One globally promoted wording is then reused for all directions. |
| I10 — projections remain detached | Merge/promotion changes canonical evidence but not old portfolio row links or copied facts. Deleting an evidence row uses an FK that leaves a portfolio row with a null link, rather than declaring it outdated. There is no fact-version dependency manifest. |

Primary code: [kind compatibility and weights](/home/mirzzie/Projects/careeros-transfer-20260601-205559/careeros/packages/portfolio/src/identity.ts:74), [admission decisions](/home/mirzzie/Projects/careeros-transfer-20260601-205559/careeros/apps/web/src/lib/identity/admit.ts:154), [same-title override](/home/mirzzie/Projects/careeros-transfer-20260601-205559/careeros/apps/web/src/lib/portfolio/reconcile.ts:138), [temporary rejection state](/home/mirzzie/Projects/careeros-transfer-20260601-205559/careeros/apps/web/src/components/evidence/same-thing-panel.tsx:102).

The UI embedding path does not rescue this. `findSameEvidence` optionally requests embeddings using an operator OpenAI key and silently falls back to lexical comparison. Admission itself does not supply embeddings. Even excellent embeddings would rank two similar jobs highly; they still would not prove they are one employment. No model call was used to establish this audit's findings.

The observed portfolio checker reproduced the Deloitte/Mastercard warning based on “job, simulation”, plus the eight findings shown in your screenshot. The canonical evidence comparison produced ten maybe suggestions. Thus the warnings are reproducible code behavior, not merely a stale screenshot.

**Additional consistency defects found while tracing the system**

- `admitEvidence` handles absorption by calling `listRenderings(...).find(r => r.isCanonical)`. The repository deliberately selects only `isCanonical=false`. Successful absorption can therefore return `row:null` despite writing the candidate; callers may report failure or fail to link the result. This is a direct source contradiction, not a live write experiment. [Caller](/home/mirzzie/Projects/careeros-transfer-20260601-205559/careeros/apps/web/src/lib/identity/admit.ts:396), [repository predicate](/home/mirzzie/Projects/careeros-transfer-20260601-205559/careeros/packages/database/src/repositories/evidence.repository.ts:39).
- Batch admission still inserts a promoted canonical before demoting the old one, without one surrounding transaction. It also drops the human-human conflict flag when collecting rewordings. Single admission has a transaction for the write transition but decides from an unlocked earlier pool read. Promotion in the UI performs separate updates in a loop.
- The actual evidence table has no unique canonical-per-fact index or fact foreign key; the fact ID is nullable. Current data happens to have no zero/multiple-canonical groups. That observation cannot establish protection against concurrency, deletion, or future interrupted writes.
- Evidence ranking counts repeated body-word matches; matching adapters also combine market tags into identity input. Marketing vocabulary can consequently affect both relevance and sameness. Keep those questions separate. A ranking score is not a probability of identity or a verification score.

**What the system does well**

There are useful foundations: per-direction résumé retrieval, explicit canonical-only reads, retained alternate wording, owner-scoped repository queries, a transactional manual merge, reviewed plain-text uploads, a portfolio publication flag, document version checks and immutable document revisions. The intent to preserve your words and keep public publishing reviewable is correct.

But these strengths are unevenly applied. Immutable revisions exist for generated documents while source résumés are overwritten. Approval exists for publishing but not for uncertain identity links. The central gate is consistently called in several paths, but consistently calling a wrong rule spreads the error. On this inspected account, I would trust Fadi to retain much of the text; I would not yet trust it to independently maintain the factual structure of a career or safely propagate corrections everywhere. This is a scoped data-system judgement, not a security certification of the entire platform.

**The permanent model: one employment, many truthful presentations**

Store a stable employment fact for Spark with employer identity, reported employment title, start/end precision, location and employment/client relationships. Attach separately:

- A DevOps wording emphasising real automation, deployment and Linux work.
- An IT-support wording emphasising real troubleshooting, support and administration.
- References to the particular source version and claims supporting each sentence.

Tailoring may reorder, select and rephrase supported duties. It cannot create another employer, extend employment dates, turn a lab into paid employment or invent a formal job title. If a title is intentionally presented differently, preserve the reported title and an explicitly reviewed display title. Do not silently equate all title changes with either a new job or a factual correction.

A project during that employment gets its own project ID with a `performed_during` relation. An MSc and its dissertation get separate IDs with a relationship. A credential has its own issuer/credential identity. Repeated achievements or projects at the same employer cannot be uniquely identified by organisation/year alone.

A practical implementation can stay in the current PostgreSQL monolith:

| Record | Responsibility |
| --- | --- |
| Source version | Immutable imported text/hash, source type, audience/direction, revision, extraction version. Exact supporting spans or structured source entries accompany claims. |
| Career fact | Stable owner-scoped ID, typed structural fields, confirmed/provisional/disputed/retracted status, revision number. Organisation aliases and employer/client roles are explicit. |
| Rendering | Text for an audience linked to a fact, source version and supported claims. No independent authority to change employer/dates. |
| Identity decision | Durable same/different/related/corrected decision, affected IDs and versions, who decided, why, and reversible history. |
| Existing output plus references | Portfolio/document/story retains editorial presentation but records fact IDs and revisions used. Corrections mark affected outputs stale rather than silently rewriting approved prose. |

This is a schema and workflow correction, not a need for a graph database, a new multi-agent service or mandatory embeddings. Provenance should distinguish source entities, derivation and revision; the W3C PROV model provides a useful vocabulary without requiring an RDF implementation. [W3C PROV-DM](https://www.w3.org/TR/prov-dm/).

**A resolution pipeline that can be trusted**

1. Fingerprint the import and source entries. Reimporting identical content must be idempotent even with one record and no AI provider.
2. Extract typed entities and claims with source references. Missing employer or date remains unknown; it is not invented or defaulted into employment.
3. Retrieve candidates using source mappings, confirmed aliases, typed anchors and optional text similarity. Similarity retrieves candidates; it does not establish equivalence.
4. Apply structural constraints before scoring: degree versus project is related/distinct; genuinely different employers require an explicit relationship/correction; precise disjoint periods cannot be called overlapping. Shared URLs only anchor identity when they identify the specific work, not a company homepage, shared repository or logo.
5. Separate **same fact/new wording**, **new fact**, **related fact**, **factual conflict**, and **insufficient information**. A lexical maybe remains a review candidate and does not demote another item. Entity identity and claim truth are separate decisions.
6. Ask only about consequential uncertainty: “This version says a different employer. Is it a correction or a different job?” Persist the answer. Harmless audience phrasing should require no question.
7. Commit identity, wording and decision atomically with per-user/import serialization or suitable row locks and retry handling. Enforce storage invariants in the database. A partial unique index can enforce **at most one** canonical row in a transitional schema; it cannot guarantee existence, correct grouping, or identical concurrent-new-import resolution. [PostgreSQL partial unique indexes](https://www.postgresql.org/docs/17/indexes-partial.html).
8. Record a durable change/invalidation entry in the same transaction. Update private projections, propose public changes, and show affected older outputs. Prevent future generation from using retracted claims or unreviewed factual conflicts.

The user journey should be: upload résumé → “New wording for 3 existing roles; 1 employer needs clarification” → one focused decision → reuse the correct version automatically. Not ten generic pair cards with Delete buttons. Show both employer/date/source fields where a factual decision is needed, and separate “same work” from “project completed during this job”.

**Repair order and acceptance evidence**

First stop uncertain and cross-kind automatic grouping. Fix the null canonical-return path, batch atomicity and dropped attribution. Preserve source versions and durable “different” decisions before extracting again. These are containment changes; do not rerun the existing extractor over the corrupted pool as a cleanup strategy.

Then repair existing groups from the saved rows: degrees and credentials must stand independently; related projects need separate facts; duplicated job wordings can be mapped to their actual employment. Relink portfolio references through stable facts without dropping images, prose or publication choices. Review the older Hexastack outputs and regenerate/correct active drafts and stories; preserve revision history with clear supersession. The cross-kind groups listed above are a concrete repair queue, not a licence to blindly split all variants and create another duplicate backlog.

Finally make projections version-aware, select role-specific renderings, and validate field-level changes before export/publication. Tests must cover actual admission through repository transactions and downstream projection, including:

- Same employment rewritten for DevOps and support → one fact, two retrievable renderings.
- Same job title at two employers → distinct facts unless an explicit correction/relationship is confirmed.
- MSc, dissertation, internship and credential → separate facts with optional relations.
- Repeated and concurrent imports → no new facts/renderings for identical source entries.
- Missing dates, month precision, genuine concurrent work, employer aliases and two stints at one employer.
- One-record pool; unrelated corpus additions and input order cannot change an already confirmed identity.
- “Different” persists across reloads, imports and surfaces.
- A merge/split/promotion updates references, preserves the canonical invariant and retains portfolio edits.
- Retracting Hexastack prevents regeneration and visibly invalidates every dependent active output.

**Validation and limitations**

`reproduction-results.json` records nine synthetic probes through the real functions plus findings from the pre-cleanup live snapshot. The build replaces only database/logger/server-only seams; it does not reimplement the identity algorithm. No live mutation was used to test admission. The focused existing suite passed 45/45 across five files while these counterexamples remained reproducible. That demonstrates a coverage gap, not a calibrated accuracy percentage.

The live snapshot establishes current grouping and source content, not the original actor or complete causal history. Full raw account data remains outside the report. The permanent architecture and engine changes above are recommendations; they have not been represented as implemented by this audit. The only production mutation here was the specifically authorised Hexastack cleanup.
