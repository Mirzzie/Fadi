# Cross-page alignment audit — 19 October 2026

## Scope and evidence

REA passively inspected the authenticated Overview route at the owner's effective 780px viewport:

- target inventory: `ev_2127cfafcc4866558066b3f3beef5de6d0262c8720a62ce7ab4ccbc8cd2602ab`
- visible viewport: `ev_25b60ce391526907a74c0a49994bbbc9a01558af7619d7f333880cd73e107c1c`
- corrected Overview viewport: `ev_9a4eac3695346e892963a0c37434d7bb550f12207da81ac0c012bbfe4471fde0`

An authenticated read-only browser audit then visited all 17 reachable top-level dashboard routes at
the narrow desktop viewport. It measured the document and heading geometry rather than judging only
one screenshot. Dynamic editor, application and project IDs were checked through their shared page
wrappers because the current account did not provide one example of every object.

## Findings

1. The shared shell increased its gutter at both `sm` and `md`. At the owner's browser zoom the
   viewport sits immediately above `md`, turning a normal inset into the conspicuous blank strip.
2. Report, interview, activity, machines, evidence, network, portfolio, application workspace,
   document editor and project workspace added a second horizontal page gutter inside the shell.
3. Page titles varied from 16px to 60px without a task-based reason. People, interview setup and
   practice administration looked like card labels rather than destinations.
4. `CVs and letters` was still advertised as a My career route, but that route redirects to the
   Applications surface. The label and destination owner contradicted one another.
5. A completion-share image still used the retired teal identity. Routine momentum and document
   surfaces also retained legacy glow decoration.
6. No audited top-level route had horizontal document overflow after the gutter correction.

## Resolution and surface delta

- One 16px shell gutter now owns normal-page horizontal alignment at every viewport.
- Removed the redundant inner gutter from the affected page wrappers. Focus workspaces retain their
  small shell-owned safety inset.
- Promoted undersized destination headings to the shared 30px working-page hierarchy and removed
  decorative icons that displaced the heading baseline.
- Removed `CVs and letters` from My career. Documents remain the Documents view inside Applications;
  document editor routes now keep Opportunities / Applications active through a route alias.
- Replaced the remaining teal completion-card colours with Fadi's indigo neutral palette and removed
  routine glow from momentum and document editing.

Primary actions and state owners are unchanged. No new control, route, data store or workflow was
added.
