# Navigation and space audit — 19 October 2026

## REA reference evidence

This pass uses the previously captured live reference observations:

- Pipecat: `ev_66687714758c19f7ecc2215ba7b5f66220818bebc5edf9f613ff259c66b7b4c3`
- Paperclip: `ev_26ad3b66dfc011bdbba8a71bad9d302da51e45283409dc258d3aa43232b42ef4`
- Fadi public surface after the shared-system pass:
  `ev_f99d4db90e8d25cb9458734861467a867ee16fdd5afd6c9170ec4021c491c353`

REA's Fadi observation is limited to the public, unauthenticated surface because the isolated REA
browser has no user's authenticated session. Authenticated-shell conclusions below are therefore
source-backed implementation decisions, not claims of REA-observed runtime behavior.

## Space removed

- Desktop navigation rail: 240px to 200px.
- Main content inset: 264px to 216px, recovering 48px for the user's work.
- Removed the repeated desktop brand from the top bar; the rail now owns platform identity.
- Removed the clock; the operating system already owns time.
- Removed the top-bar voice toggle; the persistent Fadi control already owns voice state and action.
- Removed the shell's decorative top gradient; the shared canvas treatment owns atmosphere.
- Reduced secondary navigation height and the gap below it.
- Reduced bottom padding while retaining clearance for mobile navigation.

## Navigation retained and why

- Four destinations remain: Today, Opportunities, Practice, and My career. Each represents a
  distinct stage of the core journey and owns several routes.
- Direction switching stays persistent because it changes the scope of data across the product.
- Apply/Prepare stays persistent because it changes Today and voice guidance, although it is now
  visually subordinate.
- Search/command, approvals, activity, and account remain in the top bar because each has a
  distinct owner and can require attention from any route.

## Primary action and state ownership

The shell introduces no primary action. It only provides navigation and global state controls;
each page continues to own its one primary action. Active route comes from the pathname, career
direction from the existing track repository, phase from the existing cookie, and Fadi status from
the existing presence provider.

## Follow-up verification

The authenticated shell still needs a signed-in visual pass at wide and narrow breakpoints. REA
cannot inherit the person's browser credentials, so that pass must use a deliberately authenticated
test session rather than claiming coverage from the public capture.
