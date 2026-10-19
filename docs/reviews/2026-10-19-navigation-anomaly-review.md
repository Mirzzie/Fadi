# Navigation anomaly review — 19 October 2026

## Evidence

The decision uses the live REA structure and viewport captures for Pipecat and Paperclip:

- Pipecat: `ev_66687714758c19f7ecc2215ba7b5f66220818bebc5edf9f613ff259c66b7b4c3`,
  `ev_e2aec54f97bc5a6411251656bc688a5580c8247df220fa10b0ff160cf2cb9bc8`
- Paperclip: `ev_26ad3b66dfc011bdbba8a71bad9d302da51e45283409dc258d3aa43232b42ef4`,
  `ev_be87dfc65404fc84d8f5df5ea9eb57727362147ca95d606a0ed5d39e33c8a609`
- Fadi public structure: `ev_cf73d23f41e73c07a487bb8606b05a21bb4f7dfe385d643c06d0b447cf9b8d07`
- Paperclip product page target and passive page inspection: `ev_9657c37fcc7d028be5e0bb296bffe32356e2a8645ae40cb87dd7c36216be5142`,
  `ev_d2cb3b4a20327ece243400d134217e2d6138942bbca63cf56811683363f64998`

The authenticated screenshots supplied by the owner provide visual evidence for the private shell;
REA cannot attach to that browser because it has no exposed CDP endpoint.

## Anomalies

- Three simultaneous navigation layers: utility bar, section row, and destination dock.
- The section caption repeated the active bottom destination (`Practice` above `Learning`).
- `Fadi ready` spent horizontal space communicating the normal state.
- The full-width section row consumed about one additional control-bar height on every desktop page.
- The floating dock could cover controls near the viewport bottom.
- The glowing briefing was visually inconsistent with the new neutral system.

## Resolution

- Keep the top bar because it owns global direction, search, approvals, activity, theme, and account.
- Keep the global bar limited to identity, active direction, search, decisions, activity, theme, and
  account. Destination-local categories are not global controls and no longer appear there.
- Do not render sibling-page links as a persistent horizontal row. The first in-canvas revision still
  read as a second top navigation bar, despite no longer sharing the global header.
- Put sibling pages behind the active item in the floating dock. Selecting the current destination
  opens a small upward tray; selecting a sibling closes it. This keeps those routes available without
  permanently taking space from the page.
- Collapse the ordinary ready state to its green status dot; show text only for work, waiting,
  blocked, or offline states.
- Give the bottom dock an explicit hide/show control.
- Flatten the briefing into a neutral ruled surface and remove its animated glow.

No navigation route, global state owner, or action was removed.

## Correction after owner review

The first revision put `My record`, `CVs and letters`, and `Portfolio` in the persistent header on
wide screens. Moving them just below the header still looked like a second top bar, so the final
revision removes that row entirely. The revised shell follows the reference distinction observed in
Paperclip: the persistent header is global, while the floating navigation reveals destination detail
only when requested. This is a design inference from the observed reference structure, not a claim
that Fadi duplicates Paperclip's information architecture.

## Landing copy correction

The previous public hero repeatedly asserted honesty (`tells you the truth`, `no hype`, `never
invented`) and displayed fictional career scores, albeit labelled as a sample. That sounded defensive
and asked the visitor to trust claims before seeing the product. The replacement describes concrete
work and replaces the score theatre with the four product destinations. REA observed the revised
local page at `ev_73600f3878260bc998eed9b96c850017cae9b8d830e3caf191e8dc88b3e0ca99` and captured its
visible viewport at `ev_9b66e0950edc90a9f03af1e85dab96988d4651afcaede02bfe6436afba43c285`.
