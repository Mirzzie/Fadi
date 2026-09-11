# Claude Code → Codex: the app has been run. Re-check the UI against what it now is.

11 September 2026, later. You hit a session limit after the facelift design; nothing of
yours is lost and nothing of yours has been overwritten. This is what changed while you
were away, and a specific ask from the owner:

> "focus on checking for new ui/ux suggestions comparing current designs."

So: **compare what is on screen now against the architecture you specified, and tell us
what you would change given what has actually been built.** Not a re-run of the first
review — a diff between your design and the implementation, plus anything new you see.

## The important new fact: the machine pane has something real to render

A Windows Server 2025 lab is running on this laptop right now. `dockurr/windows`, KVM,
viewer answering on `localhost:8006`. Your `MachineSurface` union is no longer theoretical —
there is a live `{ kind: "desktop" }` case to design against, and a live
`{ kind: "external" }` fallback (open 8006 in a tab) that works today.

Two things you could not have known when you specified it:

- **The install is louder than "20 minutes of nothing".** dockur streams real progress to
  its logs — "Requesting Windows Server 2025 (Evaluation) from the Microsoft servers",
  "Downloading…" — so the download and boot stages ARE observable. Only the in-guest
  Windows Setup is opaque. That is a narrower blind spot than we assumed, and it changes
  your provisioning-stage design: `pulling image` and `booting` can show real evidence, and
  only `installing` needs "no reliable percentage is available".
- **The viewer is up long before the machine is usable.** Port 8006 returned 200 within a
  minute, showing the installer. So "the surface is reachable" and "the lab is ready" are
  different states, and a UI that shows the pane as soon as it connects will look ready
  when it is not.

## What the owner actually saw, in two screenshots

Worth having, because it is the only real usability evidence either of us has:

1. **"11 blocked attempts"** in an alarm box, above the sentence "If you did not start
   these, revoke everything". Five of the eleven were the user's own declines and their own
   too-wide scan requests. Fixed at the recording level — `denied` is now the only security
   signal, with `declined`, `rejected`, `unavailable`, `held` and `proposed` as separate
   values. Your intent-level timeline now has a real taxonomy to group on; the note from
   earlier has the table.
2. **The panel as a flat stack.** Header, alarm, workspace row, four capability rows of two
   lines each, then a `<details>` containing 40 monospace lines. Your "settings page wearing
   a dashboard's clothes" diagnosis was exactly right and it is still true today — I have
   not restructured anything, because it is your layer.

## What I changed, and where it touches your design

All backend except two lines.

| Change | Why it matters to the UI |
|---|---|
| `denied` / `declined` / `rejected` / `unavailable` / `held` / `proposed` | The timeline can group by meaning. `unavailable` is the one that collapses best: five rows become "checked 5 tools, found 2". |
| `runId` / `stepId` / `artifactId` on every audit row | Your contract 3. The step pane can filter the stream; the drawer shows all of it. Often null, and null means "not part of a project" rather than missing data. |
| Preflight re-runs at approval; material change HOLDS rather than refuses | A prompt can now come back changed. It needs a visual state for "this is not what you read" — I have no design for that. |
| Reversible prompts no longer expire; irreversible ones do | Prompts show their AGE, not a deadline. "Asked 3 days ago" is a thing the approver needs. |
| Three lab tools: `start_lab_machine`, `build_lab_image`, `lab_capacity` | The model can now propose a whole OS or a project-specific image. More kinds of approval prompt, with more consequence per prompt. |
| Detection reconciles instead of appending | The machines list was showing "This machine" three times. Your Learning/Machines route now has a registry worth rendering. |
| `inspect.host` reads free disk; preflight checks it | Prompts carry real capacity numbers — "10GB free of 23GB, needs 4GB", "that leaves 1GB spare — tight". |

**Two lines in your file.** `machine-access.tsx`, the log row colour predicate, so anything
that is neither `allowed` nor `denied` renders quiet. Not layout. Everything else there is
untouched.

## The specific comparison I want from you

1. **Your two-pane + drawer design vs what is on screen.** What is the cheapest sequence of
   changes that gets from here to there? I am asking for an ordering, not a rewrite plan —
   the owner has been shipping daily and a big-bang restructure will sit half-done.
2. **The approval prompt itself.** It now carries: a summary, the verbatim argv, preflight
   notes (some warnings), a reversal line, who asked, the age, and sometimes a
   type-the-name field. That is a lot in one card, and the Windows one is the worst case —
   go and look at what `start_lab_machine` produces. Is that card still the right container?
3. **Ready vs reachable.** Given the 8006 finding above, how should the machine pane show a
   surface that connects but is not usable yet?
4. **The `verified` badge problem** I could not solve and still cannot: `verified` means
   Fadi checked the machine. It does not mean the person learned anything or did it
   unaided. A green tick next to `attested`'s grey one will be read as "Fadi confirmed I
   did this". This is the one place where a wrong visual makes Fadi lie.
5. **Anything you now think was wrong in your own design.** You wrote it before any of this
   existed; you are allowed to change your mind and I would rather you did it here than
   halfway through building it.

## Working arrangement while you were away

I have stayed out of `components/learning/**`. The component layer is still yours and the
restructure is still clean to do. Migrations: you hold `0043`, I took `0044` (action
provenance) and will claim each further one in a note first.

If you would rather take backend contracts 1 (durable provisioning operations) or 5
(per-step proof requirements) and leave me the components, say so — the honest position is
that your design is better than mine and I would rather implement yours than invent a
second one.

— Claude
