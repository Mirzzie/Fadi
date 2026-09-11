# Claude Code → Codex: the audit log had four different things called "denied"

11 September 2026. Short note, because it lands in the area you are redesigning (your item
3, the intent-level timeline) and changes what the rows mean.

## What the owner saw

A screenshot of the monitor reading **"11 blocked attempts"**, under the sentence *"If you
did not start these, revoke everything and look at what Fadi last read."* Five of the
eleven were:

```
you asked for action.deny  via dashboard:permissions — You declined this request.   ×3
you asked for network.sweep via dashboard:find_machines — Parameters rejected: {"cidr":"172.19.0.1/16"}
you asked for network.sweep via dashboard:find_machines — Parameters rejected: {"cidr":"172.18.0.1/16"}
```

Three of their own declines and two of their own scan requests, presented back to them as
attacks. Plus six `error` rows that were only "podman is not installed".

Two separate mistakes, and the second is mine twice over:

1. **`decision` was carrying four different meanings.** I had already established for the
   circuit breaker that a person declining is the system working and must not count — and
   then failed to apply the same rule to the display, because the *recording* did not
   distinguish them. The breaker was right and the column was wrong.
2. **The UI offered a button that could not work.** "Scan 172.19.0.1/16" came from listing
   every interface CIDR; the validator caps sweeps at /22. So the button could only fail,
   and its failure was then rendered as a security event. A UI mistake wearing an alarm.

## The taxonomy now

| value | means | in the alarm? | in the breaker? |
|---|---|---|---|
| `allowed` | it ran | no | no |
| `denied` | **Fadi wanted something and was not permitted** | **yes** | yes (non-human actors) |
| `declined` | the person said no | no | no |
| `rejected` | malformed or out of bounds — validation feedback | no | no |
| `unavailable` | the tool is not installed here | no | no |
| `held` | refused for now; the situation changed since it was read | no | no |
| `proposed` | Fadi asked, nothing has happened | no | no |
| `error` | it ran and failed | no | no |

`denied` is now the only security signal. Everything else is still **logged** — a model
repeatedly failing validation is worth seeing — it just does not belong under "if you did
not start these, revoke everything".

Wide ranges are now **narrowed rather than refused**: `172.19.0.1/16` becomes
`172.19.0.0/24` around the host address, and the narrowing is disclosed on the button,
because scanning something other than what the label says would be worse than not offering
it.

## What this means for your timeline

- Group on `denied` alone for anything that looks like an incident. The other six values
  are activity, not alerts.
- `unavailable` is the one that collapses best — "checked for Docker, Podman, libvirt,
  VMware, WSL: 2 found" is one row, where today it is five.
- `declined` is worth showing prominently but as *the user's own history*, not as a
  problem. "You declined 3 requests" is a useful thing to be able to see.
- The three legacy `action.deny` rows have had their decision corrected but their
  `capability` is unrecoverable — I did not guess which recipe each decline belonged to.
  New rows name the actual recipe.

## Files I touched in your area

Two lines in `machine-access.tsx`: the log row colour predicate, so anything that is
neither `allowed` nor `denied` renders quiet instead of green. Not layout, and it would
have been actively misleading left as it was. Everything else in that file is untouched and
still yours.

I corrected 13 existing rows in the dev database with three targeted updates scoped by
exact `detail` text — a recording bug being fixed, not history being tidied. The 10 genuine
`No live grant` denials were left exactly as they are.

— Claude
