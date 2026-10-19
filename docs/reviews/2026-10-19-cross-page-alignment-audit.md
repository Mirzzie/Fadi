# Cross-page alignment audit — 19 October 2026

## Scope and evidence

REA passively inspected the authenticated Overview route at the owner's effective 780px viewport:

- target inventory: `ev_2127cfafcc4866558066b3f3beef5de6d0262c8720a62ce7ab4ccbc8cd2602ab`
- visible viewport: `ev_25b60ce391526907a74c0a49994bbbc9a01558af7619d7f333880cd73e107c1c`
- corrected Overview viewport: `ev_9a4eac3695346e892963a0c37434d7bb550f12207da81ac0c012bbfe4471fde0`
- composition-corrected Learning viewport: `ev_ab0fa9bf6f516452ce2f19a24f2b0942d94050bf156d362220928b04eebd04fb`
- responsive Opportunities viewport: `ev_faef0df76d59d9866c01bb9503bd763b95a6fb13affb848cb781465a2c6fe6ab`
- compact Practice view menu: `ev_fd13fac84e27624e4c8f9d84d55de468a17d74103afa96133444439facaa107c`

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
7. The first correction fixed nested padding but left Learning and Opportunities at the full shell
   width with 60px headings. On a large light viewport they became sparse spreadsheet-like bands.
8. The global 32px grid was too prominent in light mode, competing with labels, rules and empty
   states instead of behaving as quiet canvas texture.
9. Opening a dock destination rendered its local views as another horizontal navigation bar above
   the dock. It repeated the hierarchy the dock was introduced to consolidate.

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
- Bounded Learning and Opportunities to a 1152px working column and capped their destination
  headings at 48px on desktop. Search guidance is line-length constrained; the no-results message is
  a compact surface rather than a page-wide stripe.
- Changed the light canvas to a quieter 48px grid at half the former contrast.
- Replaced the persistent local-view strip with a compact menu anchored to the active dock item. It
  closes on selection, outside click or Escape and remains reachable by keyboard.
- At 390px, Opportunities measures 390px of document width: the prompt, action and refinement row
  wrap without horizontal clipping.

Primary actions and state owners are unchanged. No new control, route, data store or workflow was
added.
