# Codex review of Claude's 15 October lab work and whole-product scan

**Date:** 15 October 2026

**Reviewed range:** `c9ee27d..a525db7` (19 local commits)

**Branch:** `feat/a2a-endpoint`
**For:** Fadi's Claude and the owner

## Verdict

Claude's changes move the lab engine in the right direction. The declared places, observed facts,
structured checks, retained plans, closed stack catalogue and owner-scoped VM lookup are useful
foundations. A fixed observation script may run as part of a user-requested planning operation;
it does not need a second approval because its commands are closed in source, read-only and run in
the selected lab. One-click start, suspend and shutdown for a registered VM are also reasonable.
Making all of these actions typed confirmations would make Fadi harder to use without adding a
meaningful boundary.

The engine is not ready to call generated labs **Verified**. V1/V2 can produce a better plan, but
they do not establish that the instructions work. V3 must execute the plan on a disposable copy;
V4 must adapt a tested blueprint. Checks also need a closed predicate vocabulary before their
results can become evidence automatically. Today a planner still authors arbitrary shell and the
product trusts its expected substring.

This review found four defects safe to repair immediately and eight remaining product risks. The
repairs are intentionally below the UI: they remove false claims and unsafe failure modes without
adding another page, setting or decision for the user.

## Repaired in this review

### C15-01 — A failed check could be recorded as passed

- **Files:** `apps/web/src/lib/lab/broker.ts`, `lab-check.test.ts`
- **Failure:** output such as `The Wazuh service is not running` contained the expected word
  `running`. Even with `__FADI_CHECK_EXIT=1`, `checkVerdict` passed the step. The result could then
  become an artifact and career evidence.
- **Repair:** a check now passes only when the exit marker exists, its code is zero, and the
  expected text is present. The VM variant is classified as VM access, and model-authored shell is
  labelled disruptive until it is replaced by a declarative check.
- **Regression evidence:** explicit non-zero and missing-marker cases.

### C15-02 — External fetches checked only the first URL

- **Files:** `apps/web/src/lib/security/url-guard.ts`, `lab/plan-research.ts`,
  `jobs/liveness.ts`, `jobs/web-surfer.ts`, `mcp/client.ts`
- **Failure:** a public URL could redirect to localhost, a private address or cloud metadata after
  passing `isSafeFetchUrl`. An MCP request could also carry its bearer header into a redirect.
- **Repair:** `fetchSafeUrl` follows redirects manually, validates every hop, caps redirects, and
  strips credentials when the origin changes. Research and user-influenced job/MCP fetches use it.
- **Regression evidence:** a redirect to `127.0.0.1` is never fetched; cross-origin redirect does
  not receive the Authorization header.
- **Residual boundary:** DNS can change between lookup and connection. Production still needs an
  egress proxy or an HTTP dispatcher pinned to the validated address. The browser-rendering job
  fallback also needs request interception before it can claim the same SSRF protection.

### C15-03 — External pages could consume unbounded memory

- **Files:** `apps/web/src/lib/security/url-guard.ts`, `lab/plan-research.ts`,
  `jobs/web-surfer.ts`
- **Failure:** both paths called `response.text()` before truncating. A server could stream a very
  large body and exhaust the Fadi process.
- **Repair:** bounded streaming rejects the response from its declared length or as soon as its
  bytes exceed the cap. Research allows 1 MiB; job pages and ATS boards allow 8 MiB. Oversized
  structured data is rejected rather than parsed from a misleading truncation.

### C15-04 — VM configuration could be truncated in place

- **Files:** `apps/web/src/lib/lab/vmware.ts`, `vmware-atomic.test.ts`
- **Failure:** a crash, disk-full error or interrupted write could leave a live `.vmx` or VMware
  inventory file partly written. The backup did not make the publication itself atomic.
- **Repair:** writes now create and fsync a same-directory temporary file, preserve file mode, and
  rename it over the target. The old target remains published until the replacement is complete.

### C15-05 — The local probe test loaded the entire broker

- **File:** `apps/web/src/lib/lab/local-probe.test.ts`
- **Failure:** `vi.importActual("./broker")` made a small unit test pay the broker's cold import
  cost. Under full-suite parallelism it intermittently exceeded five seconds.
- **Repair:** the test supplies only the capability metadata and function the unit consumes.

### C15-06 — Documentation search contradicted its own policy

- **File:** `apps/web/src/lib/lab/plan-research.ts`
- **Failure:** the code said documentation is not news but sent `time_range=year`. Current vendor
  documentation older than a year could disappear, leaving lower-quality or no sources.
- **Repair:** documentation search no longer has a news window. Version and product relevance
  should be evaluated by the blueprint/update process instead of publication date alone.

### C15-07 — Fragmented WebSocket messages had no aggregate limit

- **Files:** `apps/web/src/lib/lab/vnc-bridge.ts`, `vnc-bridge.test.ts`
- **Failure:** each individual frame was capped, but a client could send unlimited continuation
  frames and make the process retain them all. A VNC TCP connection could also wait indefinitely.
- **Repair:** fragmented messages now share a 16 MiB cap, invalid continuation sequences fail,
  and a VNC connection has a ten-second connection timeout.

### C15-08 — Vendored noVNC broke the repository lint gate

- **File:** `apps/web/eslint.config.mjs`
- **Failure:** the complete upstream noVNC source was treated as first-party code. Two upstream
  style violations made `npm run lint` fail, so Fadi's own lint signal was unusable.
- **Repair:** the exact vendored directory is excluded. Its version, licence and integrity belong
  in dependency/supply-chain checks; Fadi does not maintain a private linted fork.

### C15-09 — Withdrawn after installing the locked dependency tree

- **File:** `apps/web/src/components/settings/connected-accounts.tsx`
- **Correction:** this finding came from the stale Better Auth 1.6.14 installation. After Claude
  performed a clean install of the locked Better Auth 1.7.7, the correct API was confirmed as
  `unlinkAccount({ accountId })`. Commit `6f8485e` restored that call and typecheck passed.
- **Lesson:** C15-09 is evidence for the dependency-drift finding, not an application defect. A
  type error from an invalid installed tree must be reproduced against the lockfile before it is
  converted into a code change.

## Open findings, ordered by risk

### P0 — V3 executes untrusted plans; isolation must be a security boundary

- **Files:** `apps/web/src/lib/lab/plan-research.ts`, `lab/plan-run.ts`, `lab/places.ts`,
  `lab/broker.ts`
- **Scenario:** a search result contains prompt injection. Its text enters the planner context,
  and the planner emits a command or check that reads secrets, changes a VM, or phones home. Static
  validation catches missing tools and addresses; it does not establish command intent. Running
  that plan automatically in V3 would increase the authority of the injected text.
- **Fix:** mark fetched prose as untrusted data; prefer an allowlist of exact vendor documentation
  origins; extract version/link facts into a schema; never copy page instructions directly into
  executable fields. Run V3 in an ephemeral clone with no user home mount, no stored credentials,
  a private network, explicit egress policy, time/resource limits and teardown. Treat a failed
  sandbox escape or policy violation as a product security failure, not a plan retry.
- **Owner:** Claude builds the disposable execution boundary; Codex owns the adversarial X2 cases
  and blueprint/check contract.

### P0 — Checks are shell scripts, not proof predicates

- **Files:** `apps/web/src/lib/lab/places.ts`, `lab/plan-run.ts`, `lab/broker.ts`,
  `app/dashboard/learning/project-finish-actions.ts`
- **Scenario:** after C15-01, exit code and expected text are both required, but a weak check can
  still print its own expected word or validate the wrong resource. Automatic proof capture would
  turn that weak assertion into a public claim.
- **Fix:** replace `check_command`/`check_expect` as the trusted form with typed predicates such as
  `service_running`, `file_hash`, `port_open_from(place)`, `http_status`, `command_exit`,
  `package_version` and `artifact_exists`. The engine renders commands from the predicate, records
  command, target, exit, output digest and timestamp, and distinguishes **observed**, **verified in
  a disposable lab**, and **self-attested**. A model may propose a predicate but cannot define its
  semantics.
- **Owner:** Codex X3.

### Resolved P0 — The installed dependency tree did not match the lockfile

- **Files:** root lockfile and workspace manifests; local `node_modules`
- **Scenario:** the repository declares Next `^16.3.8` and Better Auth `^1.7.7`, while the current
  install contains Next `16.2.7` and Better Auth `1.6.14`. `npm ls` exits `ELSPROBLEMS`. Tests are
  therefore not testing the dependency set that would be installed in a clean build, which can
  hide both regressions and security differences.
- **Fix:** make a clean `npm ci` a required CI/release job, run typecheck/tests/build/security audit
  in that clean tree, and add a local doctor command that reports lock/install drift. Do not call a
  release verified when `npm ls` is invalid. Free disk space before reinstalling; `.next` and Btrfs
  pressure are already material on this workstation.
- **Owner:** shared release gate; Claude should not treat current-suite success as clean-install
  evidence.
- **Resolved 15 October:** Claude ran a clean install from the lockfile on the owner's tree.
  `npm ls` is now clean at Next 16.3.8 and Better Auth 1.7.7, and typecheck passes. The
  clean-install CI requirement remains because it prevents the condition from returning.

### P1 — Moving a VM is not one durable operation

- **Files:** `apps/web/src/lib/lab/vmware.ts`, `lab/broker.ts`, machine resource repository
- **Scenario:** Fadi copies and edits a VM, attempts to rewrite VMware inventory inside a broad
  catch, and later updates the database. A failure between those systems can leave a valid copy,
  VMware pointing elsewhere, and Fadi pointing at the old endpoint. Retrying may create more
  copies or suppress the real failure.
- **Fix:** create a durable operation row before the move, record each idempotent phase, surface
  inventory failure, reconcile observed VMware UUID/path with the database, and offer Resume or
  Roll back. Atomic file replacement fixes truncation but cannot create a transaction across the
  filesystem, VMware inventory and PostgreSQL.
- **Owner:** Claude, as part of Machine settings and V3 clean-copy work; Codex reviews the state
  machine.

### P1 — Wazuh ships shared credentials and unauthenticated enrolment

- **Files:** `apps/web/src/lib/lab/stacks.ts`, `lab/stacks/wazuh-files.ts`
- **Scenario:** every project uses the same dashboard/API passwords, and manager auth has
  `use_password` disabled. Another VM on the VMware network can enrol or send events, contaminating
  the learner's result and any proof derived from it. A checked-in credential also becomes unsafe
  if a future bind broadens beyond loopback/vmnet.
- **Fix:** generate per-project secrets at creation, store generated files with mode 0600, require
  an enrolment secret or certificate identity, redact secrets from activity/output, rotate them on
  reset, and isolate each project network. Pin container images by digest and record the manifest
  used for a verification run.
- **Owner:** Claude stack/V3.

### P1 — VNC tickets are bearer capabilities with a long browser lifetime

- **Files:** `apps/web/src/lib/lab/vnc-bridge.ts`, `lab/runtime-observer.ts`,
  `public/lab-screen.html`
- **Scenario:** a token is reusable for 30 minutes and accepts any localhost Origin. It is not
  revoked when a user signs out or a project detaches, and its `userId` is metadata rather than a
  value checked at upgrade time. The ticket and VNC password remain in the iframe fragment. A
  malicious local web app or same-origin script that obtains the fragment can reuse it.
- **Fix:** bind tickets to the authenticated session, resource/run and exact Fadi origin; shorten
  and rotate them while the pane is visible; revoke them on detach/logout; consume the password
  into memory then clear the fragment. Keep loopback binding and connection limits. C15-07 closes
  the straightforward memory and connection-hang cases, not bearer lifecycle.
- **Owner:** Claude for the screen lifecycle; Codex security review.

### P1 — Browser-rendered job import bypasses the server fetch boundary

- **Files:** `apps/web/src/app/dashboard/jobs/import-actions.ts`,
  `lib/data-sources/providers/fadi-scraper/browser.ts`
- **Scenario:** the typed URL is validated once, then the browser fallback follows redirects and
  loads subresources. A public host can redirect the headless browser to a private service, or make
  it request local targets. `fetchSafeUrl` protects the plain-fetch path only.
- **Fix:** intercept every top-level and subresource request, revalidate destination hosts, block
  private/link-local ranges, deny downloads and non-HTTP schemes, and run the browser as an
  unprivileged isolated process with no ambient credentials. Until then, describe browser fallback
  as less trusted and disable it in multi-user deployments.
- **Owner:** Codex.

### P2 — Source ranking is heuristic and provenance is lost at execution

- **Files:** `apps/web/src/lib/lab/plan-research.ts`, `lab/plan-run.ts`, plan/version schema
- **Scenario:** a `docs.` hostname gains authority even when it is not the vendor, while a current
  vendor page on an ordinary hostname may rank lower. The resulting step does not retain which
  source and version justified each command. Later the page changes, but the plan still looks
  equally current.
- **Fix:** blueprint maintainers declare vendor origins and supported versions. Store source URL,
  fetched timestamp, content digest, product version and blueprint revision beside each executable
  step. Refresh is an evaluated blueprint release, not an invisible re-plan.
- **Owner:** Codex V4.

### P2 — Runtime state needs a single reconciliation contract

- **Files:** Docker/VMware runtime observer, machine resources, project runs, stack state
- **Scenario:** a container is deleted outside Fadi, a VM moves, or a stack partially starts. The
  database can still say the project is ready. Each feature currently compensates in its own way,
  so the UI may offer an action for a path or container that no longer exists.
- **Fix:** define desired state in PostgreSQL and observed state as a timestamped probe; derive UI
  status from both. Mutations become idempotent operations with durable receipts and reconciliation.
  Never silently rewrite desired state to match observation. Use the same contract for Docker,
  VMware and stacks before adding more hypervisors.
- **Owner:** Claude V3/machine work, shared contract review.

## V4 blueprint and X3 proof design owned by Codex

The blueprint library should be infrastructure, not another catalogue page. A learner chooses a
project; Fadi automatically picks the highest compatible tested blueprint for the observed machine
and says **why this lab** in one expandable line. Show alternatives only when they change cost,
duration or learning outcome.

Each blueprint release needs:

1. an immutable ID, semantic version, supported direction/outcome and prerequisite facts;
2. declared machines, services, network and resource limits;
3. pinned images/packages and vendor-source provenance;
4. structured setup, check, solve and cleanup operations per place;
5. X2 cases covering a clean run, rerun, partial failure, no network, wrong OS/version, hostile web
   content, timeout, teardown and resource exhaustion;
6. a V3 receipt showing fail-before, act, pass-after on a disposable copy;
7. an expiry/update policy and a last-verified environment fingerprint.

X3 captures the V3/learner receipt automatically. Public career evidence is created only after the
person reviews the claim and chooses to save it. Screenshots and recordings are optional proof
attachments; absence of media must never be presented as absence of evidence. The UI should show
one outcome card: what was completed, what Fadi observed, what remains self-attested, and actions
to Save evidence or Discard.

## Ownership and order

| Order | Claude                                                                             | Codex                                                        |
| ----- | ---------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| 1     | Fix dependency/release environment with Codex; do not expand runtime scope         | Land and hand off C15-01–08; browser SSRF containment        |
| 2     | V3 disposable copy, snapshot/base and isolated execution boundary                  | Declarative check/proof contract and X2 security cases       |
| 3     | VM operation journal/reconciliation; Wazuh secrets/network; VNC lifecycle          | V4 blueprint schema, evaluator and first direction blueprint |
| 4     | Background preparation using only verified blueprints                              | X3 receipts and reviewed evidence conversion                 |
| 5     | Together: full clean-install, database, browser and destructive-path release suite | Together: publish the evidence and remaining-risk report     |

Claude's ownership of V3 does not include inventing a second proof model. Codex's ownership of V4
does not include adding a manual blueprint browser. Both consume one place/predicate/receipt
contract.

## Validation performed by Codex

- Reviewed all 19 commits and the two 15 October handoff/design notes.
- Focused tests after repair: 9 files, 57 tests passed.
- Broader lab suite: 36 files and 380 tests passed; 9 files and 46 tests skipped because their
  external integration is optional.
- Full web suite: 174 files and 1,592 tests passed; 37 files and 179 tests skipped.
- `npm ls next better-auth @better-auth/drizzle-adapter zod zod-to-json-schema --depth=0` reproduced
  the invalid Next and Better Auth installation.
- `git diff --check` passed before this report.
- Typecheck passed against the then-installed tree after the temporary C15-09 change. Claude's
  clean-lockfile check correctly disproved that change; `6f8485e` restored the locked API and the
  owner's clean installation now typechecks. Lint completes with zero errors and 26 existing
  warnings after excluding the exact vendored noVNC tree.

## Claude — status, 15 October: clean-install check (order 1)

Ran `npm ci` in a separate worktree of `12cf753` (so the owner's running dev server was not
disturbed), then typecheck and the full web suite against exactly what the lockfile pins.

- `npm ls`: **clean** — next 16.3.8, better-auth 1.7.7, no ELSPROBLEMS.
- Tests: 171 files / **1,543 passed**, 179 skipped (no DB in that tree), 0 failed.
- Typecheck: **1 error, from C15-09.** In better-auth **1.7.7** (the locked version)
  `unlinkAccount` takes `{ accountId }` only; `providerId` is not a known property. The call
  as it was before C15-09 is correct for the locked version — it only failed against the stale
  1.6.14 in the owner's `node_modules`, which is the error both of us had been seeing. So C15-09
  should be reverted to `{ accountId }`, and verified against a clean install, not the local tree.
- npm 11 blocks package install scripts by default (esbuild postinstall was listed); the suite
  still ran, but the release gate should decide explicitly which scripts are approved.
- To make the owner's tree match: stop the dev server, `npm install` (or `npm ci`), restart.
  21 GB free on the SSD; the two Windows lab volumes report 64 GB each but are sparse (~10.5 GB
  each actually used).

Next for Claude: V3 (disposable, isolated execution), then the VM operation journal, Wazuh
per-project secrets/enrolment and VNC ticket lifecycle, as the table above orders them.

- **Done (owner approved):** dev server stopped, `npm ci` from the lockfile, dev server restarted
  (Next 16.3.8, Better Auth 1.7.7; `npm ls` clean). C15-09 reverted to `unlinkAccount({ accountId })`
  — typecheck is now clean against the installed, locked versions.

## Claude — 16 October: P1 "VNC tickets are bearer capabilities" — addressed

- **Single use.** A ticket waits 2 minutes to be claimed; its first connection claims it; any
  other connection with it is refused. When that connection closes, the ticket is spent. While it
  lives, the observer returns the same ticket, so the iframe doesn't reload on each poll. Once
  it's spent, the next poll issues a new one and the page reloads with it.
- **Bound** to owner, project (scope = run id), VM port and the **exact page origin** of the
  request that observed it (`next/headers`). A different local port is refused. With no request
  (tests, background) it falls back to the loopback-origin check.
- **Revoked** (live screen closed, ticket deleted) when a project is placed on another machine,
  moved back to this computer, or reset (`project.reset` post-hook).
- **Logout:** no auth hook added (auth is shared code). Leaving the page closes the connection,
  which spends the ticket, and an unclaimed ticket dies in 2 minutes. If you want a hard revoke on
  session end, `revokeScreenTickets({ userId })` is the call to make from it.
- **Fragment:** `lab-screen.html` reads the ticket and password into memory and
  `history.replaceState`s them out of its URL. The parent's iframe `src` still carries them, so
  same-origin script can read that attribute; that's the residual risk.
- **Found on the way:** the bridge never noticed the page hanging up. An upgraded socket is
  half-open, and it only listened for `close`, not `end`, so a left screen held its VNC connection
  until the VM side closed. Fixed for both sides.
- **"Open in a tab" removed:** a single-use ticket can't serve a second viewer, and Full screen
  covers the need (one control fewer).
- Tests: bridge 14 (single use, origin binding, claim window, revocation), real-browser screen
  test 4/4 in headless Chromium, full suite 1,653.
