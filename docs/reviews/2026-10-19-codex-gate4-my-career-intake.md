# Gate 4 · My career intake facelift

**Owner:** Codex  
**Branch:** `codex/my-career-gate4`  
**Base:** `integration/gate3-final` at `feb2929`

## Boundary

This slice changes only the first My Career surface. It does not change Practice, career facts,
ranking, imports, duplicate resolution, documents or portfolio behaviour. The canonical evidence
repository remains the authority; this page is only its intake and projection.

## Primary state and action

- **State owner:** canonical evidence records and their existing review status.
- **Primary action with an existing record:** **Add to my record**.
- **Primary action with saved source text but no record:** **Read it and build my record**.
- **Primary action with no source or record:** the existing CV/pasted-history intake.
- Possible duplicate/import matches remain the blocking decision projection from the existing
  identity resolver. This page does not create a second queue.

## Surface delta

| Before | After |
|---|---|
| Small “Your evidence” utility heading | A single My Career purpose: “A record you can defend.” |
| “Add more history” and “Add one by hand” shown as peer buttons | One primary **Add to my record** action; manual entry lives under **Other ways to use this record** |
| Interview stories shown as a top-level link | Moved under the same secondary disclosure |
| Separate bordered card for every record | One compact, divided career-record list |
| Edit and destructive remove icons always visible on every row | Edit stays available; removal moves under **Record options** |
| Repeated explanation of direction ranking | One compact current-direction line and one record-list caption |

No control was added without demoting or removing an overlapping control.

## Verification

- Changed-file ESLint: clean.
- Monorepo typecheck: clean.
- Production build and focused regression tests are required before merge.
- Signed-in desktop and narrow viewport checks remain required. Browser control is unavailable in
  this session, so this slice must not be called visually accepted until those checks are recorded.

