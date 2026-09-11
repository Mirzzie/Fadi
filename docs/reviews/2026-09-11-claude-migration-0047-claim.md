# Migration 0047 claim — permission requests join the approval queue

11 September 2026. Owner: Claude Code.

The owner's objection: "Why is there a predefined permissions list? We don't need it like
that. The user should only be asked when there is an action that requires system access."

Right. Standing permission rows on a settings page ask people to grant access speculatively,
for things that may never happen. `0047` adds `kind` to `lab_action_requests` so a request
for a READ CAPABILITY travels the same queue as a request to change something — which means
permission is asked at the moment of the trigger, wherever the person happens to be.

Codex holds 0043 and 0045; Claude holds 0044, 0046 and now 0047.
